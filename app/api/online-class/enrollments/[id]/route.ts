import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: enrollment, error } = await supabase
    .from('online_enrollments')
    .select('*, tutor:online_tutors(id, name_display, name_en)')
    .eq('id', id)
    .single()

  if (error || !enrollment) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { data: sessions } = await supabase
    .from('online_sessions')
    .select('*')
    .eq('enrollment_id', id)
    .order('scheduled_date')

  return NextResponse.json({ enrollment, sessions: sessions ?? [] })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // 연결된 세션 먼저 삭제
  await supabase.from('online_sessions').delete().eq('enrollment_id', id)
  // 변경요청 삭제
  await supabase.from('online_change_requests').delete().eq('enrollment_id', id)
  // 알림 삭제
  await supabase.from('online_notifications').delete().eq('enrollment_id', id)
  // 등록 삭제
  const { error } = await supabase.from('online_enrollments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const body = await req.json()
  const allowed: Record<string, unknown> = {}
  if ('tutor_notes' in body) allowed.tutor_notes = body.tutor_notes
  if ('notes' in body) allowed.notes = body.notes
  if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'no valid fields' }, { status: 400 })
  const { error } = await supabase.from('online_enrollments').update(allowed).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
