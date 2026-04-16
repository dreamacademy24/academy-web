import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // 미해결 항목 조회
  if (action === 'pending') {
    const { data, error } = await supabase
      .from('house_pending_items')
      .select('*')
      .is('resolved_at', null)
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ items: data ?? [] })
  }

  // 보고 목록 조회
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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action } = body

    // 보고 제출
    if (action === 'submit') {
      const { reporter, report_date, time_slot, rooms, memo } = body
      if (!rooms || !rooms.length) return NextResponse.json({ error: 'rooms required' }, { status: 400 })

      const { data: inserted, error } = await supabase
        .from('house_reports')
        .insert({ reporter, report_date, time_slot, rooms, memo })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // 미해결 항목 생성
      const pendingRows: { room_no: string; content: string; status: string; report_id: string }[] = []
      for (const rm of rooms) {
        for (const it of rm.items || []) {
          if (!it.content) continue
          if (it.status !== 'done') {
            pendingRows.push({ room_no: rm.room_no, content: it.content, status: it.status, report_id: inserted.id })
          }
        }
      }
      if (pendingRows.length > 0) {
        await supabase.from('house_pending_items').insert(pendingRows)
      }

      return NextResponse.json({ ok: true, id: inserted.id })
    }

    // 미해결 항목 상태 변경
    if (action === 'update_pending') {
      const { id, status } = body
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const update: Record<string, unknown> = { status }
      if (status === 'done') update.resolved_at = new Date().toISOString()
      else update.resolved_at = null

      const { error } = await supabase.from('house_pending_items').update(update).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // 기존: 조치중/확인필요 항목 → staff_tasks 자동 생성
    if (action === 'create_task') {
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
    }

    // 하위호환: 기존 POST (action 없는 요청)
    const { room_no, content, status, report_date, reporter } = body
    if (content) {
      const emoji = status === 'progress' ? '🔄' : status === 'check' ? '❗' : '📝'
      const title = `${emoji} [${room_no || '호실'}] ${content}`
      const today = new Date().toISOString().slice(0, 10)
      const { error } = await supabase.from('staff_tasks').insert({
        title, assignee: reporter || 'all', due: today, done: false, shared: true,
        note: `하우스 보고에서 자동 생성\n호실: ${room_no || '-'}\n상태: ${status === 'progress' ? '조치중' : status === 'check' ? '확인필요' : '완료'}\n보고일: ${report_date || '-'}\n보고자: ${reporter || '-'}`,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'invalid action' }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
