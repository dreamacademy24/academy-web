import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const slot = searchParams.get('slot')

  let q = supabase.from('house_reports').select('*').order('created_at', { ascending: false })
  if (from) q = q.gte('report_date', from)
  if (to) q = q.lte('report_date', to)
  if (slot && slot !== 'all') q = q.eq('time_slot', slot)

  const { data, error } = await q.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data ?? [] })
}

// 조치중/확인필요 항목 → staff_tasks 자동 생성
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { room_no, content, status, report_date, reporter } = body
    if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

    const emoji = status === 'progress' ? '🔄' : status === 'check' ? '❗' : '📝'
    const title = `${emoji} [${room_no || '호실'}] ${content}`
    const today = new Date().toISOString().slice(0, 10)

    const { error } = await supabase.from('staff_tasks').insert({
      title,
      assignee: reporter || 'all',
      due: today,
      done: false,
      shared: true,
      note: `하우스 보고에서 자동 생성\n호실: ${room_no || '-'}\n상태: ${status === 'progress' ? '조치중' : status === 'check' ? '확인필요' : '완료'}\n보고일: ${report_date || '-'}\n보고자: ${reporter || '-'}`,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
