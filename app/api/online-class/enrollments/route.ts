import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tutorId = searchParams.get('tutor_id')

  let q = supabase
    .from('online_enrollments')
    .select('*, tutor:online_tutors(id, name_display, name_en)')
    .order('created_at', { ascending: false })

  if (tutorId) q = q.eq('tutor_id', tutorId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ enrollments: data ?? [] })
}

// 요일 매핑
const DAY_MAP: Record<string, number> = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 }

function generateSessionDates(startDate: string, endDate: string, daysOfWeek: string[], totalSessions: number): string[] {
  const dates: string[] = []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T23:59:59')
  const targetDays = daysOfWeek.map(d => DAY_MAP[d]).filter(Boolean)

  const cursor = new Date(start)
  while (cursor <= end && dates.length < totalSessions) {
    const jsDay = cursor.getDay() // 0=Sun,1=Mon...6=Sat
    const mapped = jsDay === 0 ? 7 : jsDay // 1=Mon...7=Sun
    if (targetDays.includes(mapped)) {
      const y = cursor.getFullYear()
      const m = String(cursor.getMonth() + 1).padStart(2, '0')
      const d = String(cursor.getDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${d}`)
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      student_name, student_name_en, student_birth_year, customer_user_id,
      tutor_id, enrollment_type, level, days_of_week,
      class_time_kr, class_time_ph,
      start_date, end_date, duration_weeks, class_duration_weeks, class_period,
      sessions_per_week, total_sessions, pre_sessions, post_sessions,
      package_booking_id, notes, status, day_times,
    } = body

    if (!student_name || !start_date || !total_sessions || !days_of_week?.length) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 })
    }

    // 1. Insert enrollment
    const { data: enrollment, error: enErr } = await supabase
      .from('online_enrollments')
      .insert({
        student_name, student_name_en: student_name_en || null,
        student_birth_year: student_birth_year || null,
        customer_user_id: customer_user_id || null,
        tutor_id: tutor_id || null,
        enrollment_type: enrollment_type || 'free_package',
        level: level || null,
        days_of_week,
        class_time_kr: class_time_kr || null,
        class_time_ph: class_time_ph || null,
        start_date, end_date: end_date || null,
        duration_weeks: duration_weeks || null,
        class_duration_weeks: class_duration_weeks || null,
        class_period: class_period || 'post',
        day_times: day_times || null,
        sessions_per_week: sessions_per_week || 3,
        total_sessions: Number(total_sessions),
        pre_sessions: Number(pre_sessions) || 0,
        post_sessions: Number(post_sessions) || 0,
        used_sessions: 0,
        package_booking_id: package_booking_id || null,
        status: status || 'active',
        notes: notes || null,
      })
      .select()
      .single()

    if (enErr) return NextResponse.json({ error: enErr.message }, { status: 500 })

    // 2. Generate sessions
    const calcEnd = end_date || (() => {
      const d = new Date(start_date)
      d.setDate(d.getDate() + (duration_weeks || 12) * 7)
      return d.toISOString().slice(0, 10)
    })()

    const sessionDates = generateSessionDates(start_date, calcEnd, days_of_week, Number(total_sessions))

    // 요일별 시간 (day_times: {"수":"17:00","금":"18:00"} — 한국시간 기준, 필리핀 = -1시간)
    const DAY_KR_BY_JS = ['일', '월', '화', '수', '목', '금', '토']
    const phOf = (kr: string | null) => {
      if (!kr || !/^\d{1,2}:\d{2}/.test(kr)) return null
      const [h, m] = kr.split(':').map(Number)
      return `${String((h + 23) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
    if (sessionDates.length > 0) {
      const rows = sessionDates.map((date, idx) => {
        const dayKr = DAY_KR_BY_JS[new Date(date + 'T00:00:00').getDay()]
        const overrideKr = day_times ? (day_times as Record<string, string>)[dayKr] : null
        const tKr = overrideKr || class_time_kr || null
        const tPh = overrideKr ? phOf(overrideKr) : (class_time_ph || phOf(tKr))
        return {
          enrollment_id: enrollment.id,
          tutor_id: tutor_id || null,
          session_number: idx + 1,
          scheduled_date: date,
          scheduled_time_kr: tKr,
          scheduled_time_ph: tPh,
          status: 'scheduled',
        }
      })
      const { error: sesErr } = await supabase.from('online_sessions').insert(rows)
      if (sesErr) return NextResponse.json({ error: sesErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: enrollment.id, sessions_created: sessionDates.length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, ...fields } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const allowed = ['student_name','student_name_en','student_birth_year','tutor_id','days_of_week','class_time_kr','class_time_ph','start_date','end_date','duration_weeks','class_duration_weeks','pre_sessions','post_sessions','total_sessions','sessions_per_week','status','notes','level','enrollment_type','class_period','day_times']
    const updates: Record<string, unknown> = {}
    for (const k of allowed) { if (k in fields) updates[k] = fields[k] }
    const { error } = await supabase.from('online_enrollments').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
