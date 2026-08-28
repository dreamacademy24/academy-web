import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendTelegramTeachers, escapeHtml } from '@/lib/telegram'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DAY_MAP: Record<string, number> = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 }
const DAY_KR_BY_JS = ['일', '월', '화', '수', '목', '금', '토']

function genDates(startDate: string, daysOfWeek: string[], count: number): string[] {
  const dates: string[] = []
  const targetDays = daysOfWeek.map(d => DAY_MAP[d]).filter(Boolean)
  const cursor = new Date(startDate + 'T00:00:00')
  let guard = 0
  while (dates.length < count && guard < 1000) {
    const jsDay = cursor.getDay()
    const mapped = jsDay === 0 ? 7 : jsDay
    if (targetDays.includes(mapped)) {
      dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`)
    }
    cursor.setDate(cursor.getDate() + 1)
    guard++
  }
  return dates
}

function phOf(kr: string | null): string | null {
  if (!kr || !/^\d{1,2}:\d{2}/.test(kr)) return null
  const [h, m] = kr.split(':').map(Number)
  return `${String((h + 23) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// 어드민: 변경요청 목록
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const tutorId = searchParams.get('tutor_id')          // 티쳐 수신함
  const teacherStatus = searchParams.get('teacher_status')
  let q = supabase
    .from('online_change_requests')
    .select('*, enrollment:online_enrollments(id, student_name, student_name_en, days_of_week, class_time_kr, day_times, start_date, end_date, tutor_id, tutor:online_tutors(id, name_display))')
    .order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  if (tutorId) q = q.eq('tutor_id', tutorId)
  if (teacherStatus) q = q.eq('teacher_status', teacherStatus)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data ?? [] })
}

// 어드민: 승인/거절
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, action, admin_note, teacher_note, processed_by } = body
    if (!id || !['approve', 'reject', 'teacher_approve', 'teacher_reject'].includes(action)) {
      return NextResponse.json({ error: 'id, action required' }, { status: 400 })
    }

    const { data: cr } = await supabase.from('online_change_requests').select('*').eq('id', id).single()
    if (!cr) return NextResponse.json({ error: 'request not found' }, { status: 404 })
    if (cr.status !== 'pending') return NextResponse.json({ error: '이미 처리된 요청입니다.' }, { status: 400 })

    // ── 1단계: 현지 티쳐 승인/거절 ──
    if (action === 'teacher_approve') {
      await supabase.from('online_change_requests').update({ teacher_status: 'approved', teacher_note: teacher_note || null }).eq('id', id)
      return NextResponse.json({ ok: true, teacher_status: 'approved' })
    }
    if (action === 'teacher_reject') {
      await supabase.from('online_change_requests').update({ teacher_status: 'rejected', teacher_note: teacher_note || null, status: 'rejected', admin_note: '현지 선생님 거절', processed_at: new Date().toISOString() }).eq('id', id)
      return NextResponse.json({ ok: true, teacher_status: 'rejected' })
    }
    // ── 2단계(한국인): 티쳐 승인 전이면 최종 승인 불가 ──
    if (action === 'approve' && cr.teacher_status !== 'approved') {
      return NextResponse.json({ error: '현지 선생님 승인 후 최종 승인할 수 있습니다.' }, { status: 400 })
    }

    if (action === 'reject') {
      const { error } = await supabase.from('online_change_requests')
        .update({ status: 'rejected', admin_status: 'rejected', admin_note: admin_note || null, processed_by: processed_by || '관리자', processed_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, status: 'rejected' })
    }

    // ───── 승인: enrollment 갱신 + 적용일 이후 예정 세션 재생성 ─────
    const { data: enroll } = await supabase
      .from('online_enrollments')
      .select('*, tutor:online_tutors(id, name_display, name_en)')
      .eq('id', cr.enrollment_id)
      .single()
    if (!enroll) return NextResponse.json({ error: 'enrollment not found' }, { status: 404 })

    // ── 1회차만 변경: 해당 세션의 날짜/시간만 이동 (재생성 없음) ──
    if (cr.req_type === 'single') {
      if (!cr.session_id) return NextResponse.json({ error: 'session_id 없음' }, { status: 400 })
      const patch: Record<string, unknown> = {}
      if (cr.req_date) patch.scheduled_date = cr.req_date
      if (cr.req_time_kr) { patch.scheduled_time_kr = cr.req_time_kr; patch.scheduled_time_ph = phOf(cr.req_time_kr) }
      const { error: sErr } = await supabase.from('online_sessions').update(patch).eq('id', cr.session_id).eq('status', 'scheduled')
      if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
      await supabase.from('online_change_requests').update({ status: 'approved', admin_status: 'approved', admin_note: admin_note || null, processed_by: processed_by || '관리자', processed_at: new Date().toISOString() }).eq('id', id)
      try {
        const stuName = enroll.student_name_en || enroll.student_name
        const msg = `Class moved — ${stuName}: → ${cr.req_date || '(same date)'}${cr.req_time_kr ? ` ${cr.req_time_kr} KST` : ''}`
        await supabase.from('online_notifications').insert({ tutor_id: enroll.tutor_id || null, type: 'schedule_change', message: msg })
        await sendTelegramTeachers(`📢 <b>Online Class — single session moved</b>\n${escapeHtml(msg)}`)
      } catch { /* best-effort */ }
      return NextResponse.json({ ok: true, status: 'approved', type: 'single' })
    }

    const newDays: string[] = cr.req_days_of_week?.length ? cr.req_days_of_week : enroll.days_of_week
    const newTimeKr: string | null = cr.req_time_kr || enroll.class_time_kr
    const newTimePh = cr.req_time_kr ? phOf(cr.req_time_kr) : enroll.class_time_ph
    const effective: string = cr.effective_from

    // 1) 적용일 이후 '예정' 세션 조회
    const { data: futureSes, error: fsErr } = await supabase
      .from('online_sessions')
      .select('id, session_number, scheduled_date')
      .eq('enrollment_id', enroll.id)
      .eq('status', 'scheduled')
      .gte('scheduled_date', effective)
      .order('scheduled_date')
    if (fsErr) return NextResponse.json({ error: fsErr.message }, { status: 500 })

    let regenerated = 0
    let newEndDate: string | null = null
    if (futureSes && futureSes.length > 0) {
      const numbers = futureSes.map(s => s.session_number).sort((a, b) => a - b)
      const newDates = genDates(effective, newDays, futureSes.length)
      newEndDate = newDates[newDates.length - 1] || null
      if (newDates.length < futureSes.length) {
        return NextResponse.json({ error: '새 요일로 날짜 생성에 실패했습니다. 요일을 확인해주세요.' }, { status: 400 })
      }
      // 기존 예정 세션 삭제 후 재생성 (출석/취소 이력은 그대로 보존)
      const { error: delErr } = await supabase.from('online_sessions').delete()
        .in('id', futureSes.map(s => s.id))
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

      const dayTimes = (enroll.day_times || null) as Record<string, string> | null
      const rows = newDates.map((date, i) => {
        const dayKr = DAY_KR_BY_JS[new Date(date + 'T00:00:00').getDay()]
        const ovr = cr.req_time_kr ? null : (dayTimes ? dayTimes[dayKr] : null) // 새 단일 시간 요청이면 요일별 시간은 무시
        const tKr = ovr || newTimeKr
        return {
          enrollment_id: enroll.id,
          tutor_id: enroll.tutor_id || null,
          session_number: numbers[i],
          scheduled_date: date,
          scheduled_time_kr: tKr,
          scheduled_time_ph: ovr ? phOf(ovr) : newTimePh,
          status: 'scheduled',
        }
      })
      const { error: insErr } = await supabase.from('online_sessions').insert(rows)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
      regenerated = rows.length
    }

    // 2) enrollment 갱신
    const enrollPatch: Record<string, unknown> = {}
    if (cr.req_days_of_week?.length) enrollPatch.days_of_week = newDays
    if (cr.req_time_kr) { enrollPatch.class_time_kr = cr.req_time_kr; enrollPatch.class_time_ph = phOf(cr.req_time_kr); enrollPatch.day_times = null }
    if (newEndDate) enrollPatch.end_date = newEndDate
    if (Object.keys(enrollPatch).length > 0) {
      const { error: upErr } = await supabase.from('online_enrollments').update(enrollPatch).eq('id', enroll.id)
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    // 3) 요청 상태 갱신
    await supabase.from('online_change_requests')
      .update({ status: 'approved', admin_status: 'approved', admin_note: admin_note || null, processed_by: processed_by || '관리자', processed_at: new Date().toISOString() })
      .eq('id', id)

    // 4) 튜터 알림 적재 + 티쳐 텔레그램 (영문) — 실패해도 승인은 유지
    try {
      const dayEn: Record<string, string> = { '월': 'Mon', '화': 'Tue', '수': 'Wed', '목': 'Thu', '금': 'Fri', '토': 'Sat' }
      const stuName = enroll.student_name_en || enroll.student_name
      const tutorName = enroll.tutor?.name_display || 'Unassigned'
      const msg = `Schedule update — ${stuName}: ${newDays.map((d: string) => dayEn[d] || d).join('/')}${newTimeKr ? ` ${newTimeKr} KST` : ''}, from ${effective}. (${regenerated} sessions updated)`
      await supabase.from('online_notifications').insert({ tutor_id: enroll.tutor_id || null, type: 'schedule_change', message: msg })
      await sendTelegramTeachers(`📢 <b>Online Class Schedule Update</b>\n👩‍🏫 ${escapeHtml(tutorName)}\n${escapeHtml(msg)}`)
    } catch { /* best-effort */ }

    return NextResponse.json({ ok: true, status: 'approved', regenerated })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
