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
    const { status, recorded_by, cancel_noticed_at, session_note, admin_makeup, attitude, attitude_note } = body
    if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

    // 어드민 보강 전환: 차감된 취소(cancelled) → makeup + 회차 복구 (아이 아픔 등)
    if (admin_makeup === true) {
      const { data: cur } = await supabase.from('online_sessions')
        .select('status, enrollment_id, cancel_days_before').eq('id', sessionId).single()
      if (!cur) return NextResponse.json({ error: 'session not found' }, { status: 404 })
      if (cur.status !== 'cancelled') return NextResponse.json({ error: '차감 취소 상태만 보강으로 전환할 수 있어요' }, { status: 400 })
      const { error: mkErr } = await supabase.from('online_sessions')
        .update({ status: 'makeup' }).eq('id', sessionId)
      if (mkErr) return NextResponse.json({ error: mkErr.message }, { status: 500 })
      const { data: enroll } = await supabase.from('online_enrollments')
        .select('used_sessions').eq('id', cur.enrollment_id).single()
      if (enroll && (enroll.used_sessions || 0) > 0) {
        await supabase.from('online_enrollments')
          .update({ used_sessions: (enroll.used_sessions || 0) - 1 }).eq('id', cur.enrollment_id)
      }
      return NextResponse.json({ ok: true, converted: true, message: '보강으로 전환하고 회차 1회를 복구했어요.' })
    }

    // 수업태도 기록만 단독 저장 (티쳐 화면)
    if (typeof attitude !== 'undefined' && !status) {
      const upd: Record<string, unknown> = { attitude: attitude || null }
      if (typeof attitude_note !== 'undefined') upd.attitude_note = (attitude_note || '').toString().trim() || null
      const { error } = await supabase.from('online_sessions').update(upd).eq('id', sessionId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // 노트만 단독 저장 (status 변경 없이)
    if (typeof session_note !== 'undefined' && !status) {
      const noteVal = (session_note || '').toString().trim()
      const { error } = await supabase
        .from('online_sessions')
        .update({ session_note: noteVal || null })
        .eq('id', sessionId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

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
      // 어드민이 직접 '보강'을 지정하면 날짜와 무관하게 무차감 + 보강 추가 (티쳐 결근/부득이한 사정)
      const forceMk = status === 'makeup' && body.force_makeup === true
      const effDays = forceMk ? 4 : daysBefore

      const noticedAt = cancel_noticed_at || new Date().toISOString()
      const update: Record<string, unknown> = {
        status,
        cancel_noticed_at: noticedAt,
        cancel_days_before: effDays,
      }
      if (recorded_by) { update.recorded_by = recorded_by; update.recorded_at = new Date().toISOString() }
      if (typeof session_note !== 'undefined') update.session_note = (session_note || '').toString().trim() || null

      const { error } = await supabase.from('online_sessions').update(update).eq('id', sessionId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // 4일 전 이상 + makeup(또는 어드민 직접 보강): 차감 없음, 트리거가 보강 추가
      if (effDays >= 4 && status === 'makeup') {
        // 직접 보강 지정인데 이전이 차감 상태(출석/결석/차감취소)였으면 회차 1회 복구
        if (forceMk && (prev.status === 'attended' || prev.status === 'no_show' || prev.status === 'cancelled')) {
          const { data: en2 } = await supabase.from('online_enrollments').select('used_sessions').eq('id', prev.enrollment_id).single()
          if (en2 && (en2.used_sessions || 0) > 0) {
            await supabase.from('online_enrollments').update({ used_sessions: (en2.used_sessions || 0) - 1 }).eq('id', prev.enrollment_id)
          }
        }
        return NextResponse.json({
          ok: true,
          cancel_days_before: effDays,
          makeup_added: true,
          message: '보강 처리되었습니다. 마지막 회차 이후 1회 자동 추가됩니다.',
          message_en: 'Marked as makeup. One session has been added after your last class.',
        })
      }

      // 3일 이내 (또는 cancelled): 회차 차감
      if (effDays < 4 && prev.status === 'scheduled') {
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
        cancel_days_before: effDays,
        session_deducted: effDays < 4,
        message: effDays < 4 ? '회차가 차감되었습니다.' : '취소되었습니다.',
        message_en: effDays < 4 ? '1 session has been deducted.' : 'Cancelled.',
      })
    }

    // 기존: attended / no_show / scheduled 등 일반 처리
    const update: Record<string, unknown> = { status }
    if (recorded_by) { update.recorded_by = recorded_by; update.recorded_at = new Date().toISOString() }
    if (typeof session_note !== 'undefined') update.session_note = (session_note || '').toString().trim() || null

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
    // 예정으로 되돌리기: 이전이 차감 상태였으면 회차 1회 복구
    if (prev.enrollment_id && status === 'scheduled' && (prev.status === 'attended' || prev.status === 'no_show')) {
      const { data: enroll } = await supabase
        .from('online_enrollments')
        .select('used_sessions')
        .eq('id', prev.enrollment_id)
        .single()
      if (enroll && (enroll.used_sessions || 0) > 0) {
        await supabase
          .from('online_enrollments')
          .update({ used_sessions: (enroll.used_sessions || 0) - 1 })
          .eq('id', prev.enrollment_id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
