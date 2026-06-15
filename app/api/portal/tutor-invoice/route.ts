import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { isLessonDateAllowed } from '@/lib/lessonDates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface LessonRow {
  id: string
  tutor_id: string | null
  [k: string]: unknown
}
interface SessionRow {
  id: string
  lesson_id: string
  session_date: string
  session_time: string | null
  session_idx: number
  status: string
}

// GET /api/portal/tutor-invoice?booking_id=xxx
// → confirmed 튜터 신청에 연결된 수업 + 세션 + 담당 튜터명 반환
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')
  if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

  // 1. 해당 예약의 튜터 신청 (통합 테이블 tutor_requests). 수업(lesson)은 확정 시에만 생성되므로
  //    아래 application_id 매칭에서 자연히 확정 건만 남는다.
  const { data: apps, error: aErr } = await supabase
    .from('tutor_requests')
    .select('id')
    .eq('booking_id', bookingId)
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
  const appIds = (apps || []).map((a: { id: string }) => a.id)
  if (appIds.length === 0) return NextResponse.json({ lessons: [] })

  // 2. 확정 신청에 연결된 수업 — application_id 또는 admin_memo의 request_id (옛 수업은 application_id가 빌 수 있음)
  const byAppId = await supabase
    .from('tutor_lessons').select('*').in('application_id', appIds).order('start_date', { ascending: true })
  if (byAppId.error) return NextResponse.json({ error: byAppId.error.message }, { status: 500 })
  const memoFilter = appIds.map((id) => `admin_memo.ilike.%request_id: ${id}%`).join(',')
  const byMemo = memoFilter
    ? await supabase.from('tutor_lessons').select('*').or(memoFilter).order('start_date', { ascending: true })
    : { data: [], error: null }
  const seen = new Set<string>()
  const lessons: LessonRow[] = []
  for (const l of [...(byAppId.data || []), ...((byMemo as { data: LessonRow[] }).data || [])] as LessonRow[]) {
    if (seen.has(l.id)) continue
    seen.add(l.id)
    lessons.push(l)
  }
  if (lessons.length === 0) return NextResponse.json({ lessons: [] })

  // 3. 수업별 세션
  const lessonIds = lessons.map(l => l.id)
  const { data: sessRows, error: sErr } = await supabase
    .from('tutor_lesson_sessions')
    .select('*')
    .in('lesson_id', lessonIds)
    .order('session_date', { ascending: true })
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
  const sessByLesson = new Map<string, SessionRow[]>()
  for (const s of (sessRows || []) as SessionRow[]) {
    const arr = sessByLesson.get(s.lesson_id)
    if (arr) arr.push(s)
    else sessByLesson.set(s.lesson_id, [s])
  }

  // 4. tutor_id → 튜터 이름
  const tutorIds = Array.from(new Set(lessons.map(l => l.tutor_id).filter(Boolean))) as string[]
  const tutorMap = new Map<string, string>()
  if (tutorIds.length > 0) {
    const { data: tRows } = await supabase.from('tutors').select('id, name').in('id', tutorIds)
    for (const t of (tRows || []) as { id: string; name: string }[]) tutorMap.set(t.id, t.name)
  }

  // 세션 테이블이 비어있는 신형 lesson: attendance_log 날짜 → 없으면 요일×기간 전개로 일정 생성
  const DAY_NUM: Record<string, number> = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
  function deriveDates(l: LessonRow & { attendance_log?: Record<string, string> | null; class_days?: string[] | null; start_date?: string | null; end_date?: string | null }): string[] {
    const log = l.attendance_log
    if (log && typeof log === 'object' && Object.keys(log).length > 0) return Object.keys(log).sort()
    if (!l.start_date || !l.end_date || !Array.isArray(l.class_days) || l.class_days.length === 0) return []
    const target = l.class_days.map(d => DAY_NUM[String(d || '').trim().toLowerCase()] ?? DAY_NUM[String(d || '').trim()]).filter(n => n !== undefined)
    if (target.length === 0) return []
    const out: string[] = []
    const cur = new Date(l.start_date + 'T00:00:00')
    const end = new Date(l.end_date + 'T00:00:00')
    if (isNaN(cur.getTime()) || isNaN(end.getTime())) return []
    let guard = 0
    while (cur <= end && guard < 400) {
      if (target.includes(cur.getDay())) {
        const ds = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
        if (isLessonDateAllowed(cur, ds)) out.push(ds)
      }
      cur.setDate(cur.getDate() + 1)
      guard++
    }
    return out
  }

  const result = lessons.map(l => {
    const real = sessByLesson.get(l.id) || []
    const sessions = real.length > 0
      ? real
      : deriveDates(l as LessonRow & { attendance_log?: Record<string, string> | null }).map((ds, idx) => ({ id: `virtual-${l.id}-${ds}`, lesson_id: l.id, session_date: ds, session_time: (l as { class_time?: string | null }).class_time || null, session_idx: idx + 1, status: 'scheduled' }))
    return {
      ...l,
      tutor_name: l.tutor_id ? (tutorMap.get(l.tutor_id) || null) : null,
      sessions,
    }
  })

  return NextResponse.json({ lessons: result })
}
