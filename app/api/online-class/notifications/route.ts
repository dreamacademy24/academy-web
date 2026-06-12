import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 튜터 알림: 본인 것 + 전체 공지(tutor_id null)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tutorId = searchParams.get('tutor_id')
  if (!tutorId) return NextResponse.json({ notifications: [] })

  const { data, error } = await supabase
    .from('online_notifications')
    .select('*')
    .or(`tutor_id.eq.${tutorId},tutor_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notifications: data ?? [] })
}

// 읽음 처리
export async function PATCH(req: Request) {
  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ ok: true })
    const { error } = await supabase.from('online_notifications').update({ is_read: true }).in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
