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
    const sessionId = body.session_id || body.id
    const { status, recorded_by, cancel_noticed_at } = body
    if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

    const { data: prev } = await supabase
      .from('online_sessions')
      .select('status, enrollment_id, scheduled_date')
      .eq('id', sessionId)
      .single()

    if (!prev) return NextResponse.json({ error: 'session not found' }, { status: 404 })

    // 취소/보강 분기 처리
    if (status === 'cancelled' || status === 'makeup') {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const sched = new Date((prev.scheduled_date || '') + 'T00:00:00')
      const daysBefore = Math.round((sched.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      const noticedAt = cancel_noticed_at || new Date().toISOString()
      const update: Record<string, unknown> = {
        status,
        cancel_noticed_at: noticedAt,
        cancel_days_before: daysBefore,
      }
      if (recorded_by) { update.recorded_by = recorded_by; update.recorded_at = new Date().toISOString() }

      const { error } = await supabase.from('online_sessions').update(update).eq('id', sessionId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // 4일 전 이상 + makeup: 차감 없음, 트리거가 보강 추가
      if (daysBefore >= 4 && status === 'makeup') {
        return NextResponse.json({
          ok: true,
          cancel_days_before: daysBefore,
          makeup_added: true,
          message: '보강 처리되었습니다. 마지막 회차 이후 1회 자동 추가됩니다.',
          message_en: 'Marked as makeup. One session has been added after your last class.',
        })
      }

      // 3일 이내 (또는 cancelled): 회차 차감
      if (daysBefore < 4 && prev.status === 'scheduled') {
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

      return NextResponse.json({
        ok: true,
        cancel_days_before: daysBefore,
        session_deducted: daysBefore < 4,
        message: daysBefore < 4 ? '회차가 차감되었습니다.' : '취소되었습니다.',
        message_en: daysBefore < 4 ? '1 session has been deducted.' : 'Cancelled.',
      })
    }

    // 기존: attended / no_show / scheduled 등 일반 처리
    const update: Record<string, unknown> = { status }
    if (recorded_by) { update.recorded_by = recorded_by; update.recorded_at = new Date().toISOString() }

    const { error } = await supabase.from('online_sessions').update(update).eq('id', sessionId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (prev.enrollment_id && prev.status === 'scheduled' && (status === 'attended' || status === 'no_show')) {
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
