import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const enrollmentId = searchParams.get('enrollment_id')
  const date = searchParams.get('date')
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  // 특정 enrollment의 세션 목록
  if (enrollmentId) {
    const { data, error } = await supabase
      .from('online_sessions')
      .select('*')
      .eq('enrollment_id', enrollmentId)
      .order('session_number')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ sessions: data ?? [] })
  }

  // 날짜 기반 조회 (enrollment + tutor JOIN)
  let q = supabase
    .from('online_sessions')
    .select('*, enrollment:online_enrollments(id, student_name, student_name_en, student_birth_year, status), tutor:online_tutors(id, name_display, name_en)')
    .order('scheduled_time_ph')
    .order('scheduled_date')

  if (date) {
    q = q.eq('scheduled_date', date)
  } else if (start && end) {
    q = q.gte('scheduled_date', start).lte('scheduled_date', end)
  } else {
    return NextResponse.json({ error: 'enrollment_id, date, or start/end required' }, { status: 400 })
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: data ?? [] })
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, status, recorded_by } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    // 먼저 기존 세션 조회 (이전 상태 확인)
    const { data: prev } = await supabase
      .from('online_sessions')
      .select('status, enrollment_id')
      .eq('id', id)
      .single()

    const update: Record<string, unknown> = { status }
    if (recorded_by) { update.recorded_by = recorded_by; update.recorded_at = new Date().toISOString() }

    const { error } = await supabase.from('online_sessions').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // attended 또는 no_show로 변경 시 used_sessions +1
    if (prev && prev.enrollment_id && prev.status === 'scheduled' && (status === 'attended' || status === 'no_show')) {
      const { data: enroll } = await supabase
        .from('online_enrollments')
        .select('used_sessions')
        .eq('id', prev.enrollment_id)
        .single()
      if (enroll) {
        await supabase
          .from('online_enrollments')
          .update({ used_sessions: (enroll.used_sessions || 0) + 1 })
          .eq('id', prev.enrollment_id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
