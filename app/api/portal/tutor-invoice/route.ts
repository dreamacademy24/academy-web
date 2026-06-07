import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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

  // 2. 확정 신청에 연결된 수업 (application_id)
  const { data: lessonRows, error: lErr } = await supabase
    .from('tutor_lessons')
    .select('*')
    .in('application_id', appIds)
    .order('start_date', { ascending: true })
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
  const lessons = (lessonRows || []) as LessonRow[]
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

  const result = lessons.map(l => ({
    ...l,
    tutor_name: l.tutor_id ? (tutorMap.get(l.tutor_id) || null) : null,
    sessions: sessByLesson.get(l.id) || [],
  }))

  return NextResponse.json({ lessons: result })
}
