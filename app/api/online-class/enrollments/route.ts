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
        portal_open: body.portal_open === true,
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
    const { id, regenerate_sessions, ...fields } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const allowed = ['student_name','student_name_en','student_birth_year','tutor_id','days_of_week','class_time_kr','class_time_ph','start_date','end_date','duration_weeks','class_duration_weeks','pre_sessions','post_sessions','total_sessions','sessions_per_week','status','notes','level','enrollment_type','class_period','day_times','portal_open']
    const INT_FIELDS = new Set(['duration_weeks','class_duration_weeks','pre_sessions','post_sessions','total_sessions','sessions_per_week'])
    const updates: Record<string, unknown> = {}
    for (const k of allowed) {
      if (!(k in fields)) continue
      let v = fields[k]
      // 빈 문자열 → null (integer 컬럼에 "" 넣으면 Supabase 에러)
      if (v === '' || v === undefined) v = null
      // 숫자 필드는 명시적 변환
      if (INT_FIELDS.has(k) && v !== null) v = Number(v) || 0
      updates[k] = v
    }
    // 튜터 변경 감지: 기존 tutor_id 먼저 조회
    let oldTutorId: string | null = null
    if ('tutor_id' in updates) {
      const { data: prev } = await supabase.from('online_enrollments').select('tutor_id').eq('id', id).single()
      oldTutorId = prev?.tutor_id ?? null
    }

    const { error } = await supabase.from('online_enrollments').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 튜터 변경 시 모든 세션의 tutor_id도 자동 동기화
    let sessionsTutorSynced = 0
    if ('tutor_id' in updates && updates.tutor_id !== oldTutorId) {
      const newTutorId = (updates.tutor_id as string) || null
      const { data: synced } = await supabase
        .from('online_sessions')
        .update({ tutor_id: newTutorId })
        .eq('enrollment_id', id)
        .select('id')
      sessionsTutorSynced = synced?.length ?? 0
    }

    // 세션 재생성 요청 시: 기존 scheduled 세션 삭제 → 새 요일/시간 기준 재생성
    let sessionsRegenerated = 0
    if (regenerate_sessions) {
      const { data: enroll } = await supabase
        .from('online_enrollments')
        .select('*')
        .eq('id', id)
        .single()
      if (enroll) {
        // attended/cancelled 등 이력이 있는 세션은 보존, scheduled만 삭제
        const { data: scheduledSes } = await supabase
          .from('online_sessions')
          .select('id')
          .eq('enrollment_id', id)
          .eq('status', 'scheduled')
        if (scheduledSes && scheduledSes.length > 0) {
          await supabase.from('online_sessions').delete().in('id', scheduledSes.map(s => s.id))
        }

        // 이력 세션 수 카운트 (출석/취소 등)
        const { data: historySes } = await supabase
          .from('online_sessions')
          .select('session_number')
          .eq('enrollment_id', id)
          .neq('status', 'scheduled')
          .order('session_number', { ascending: false })
        const lastNum = historySes?.length ? Math.max(...historySes.map(s => s.session_number)) : 0
        const historyCount = historySes?.length || 0

        const total = enroll.total_sessions || 0
        const needed = total - historyCount
        if (needed > 0 && enroll.days_of_week?.length > 0) {
          // 시작 날짜: 이력 마지막 날짜 다음 날 or enrollment start_date
          let startFrom = enroll.start_date
          if (historySes?.length) {
            const { data: lastSes } = await supabase
              .from('online_sessions')
              .select('scheduled_date')
              .eq('enrollment_id', id)
              .neq('status', 'scheduled')
              .order('scheduled_date', { ascending: false })
              .limit(1)
            if (lastSes?.length) {
              const d = new Date(lastSes[0].scheduled_date + 'T00:00:00')
              d.setDate(d.getDate() + 1)
              startFrom = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            }
          }

          const calcEnd = enroll.end_date || (() => {
            const d = new Date(enroll.start_date)
            d.setDate(d.getDate() + (enroll.duration_weeks || 52) * 7)
            return d.toISOString().slice(0, 10)
          })()

          const dates = generateSessionDates(startFrom, calcEnd, enroll.days_of_week, needed)
          const DAY_KR_BY_JS2 = ['일', '월', '화', '수', '목', '금', '토']
          const phOf2 = (kr: string | null) => {
            if (!kr || !/^\d{1,2}:\d{2}/.test(kr)) return null
            const [h, m] = kr.split(':').map(Number)
            return `${String((h + 23) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
          }
          const dt = enroll.day_times as Record<string, string> | null
          const rows = dates.map((date, idx) => {
            const dayKr = DAY_KR_BY_JS2[new Date(date + 'T00:00:00').getDay()]
            const overrideKr = dt ? dt[dayKr] : null
            const tKr = overrideKr || enroll.class_time_kr || null
            const tPh = overrideKr ? phOf2(overrideKr) : (enroll.class_time_ph || phOf2(tKr))
            return {
              enrollment_id: id,
              tutor_id: enroll.tutor_id || null,
              session_number: lastNum + idx + 1,
              scheduled_date: date,
              scheduled_time_kr: tKr,
              scheduled_time_ph: tPh,
              status: 'scheduled',
            }
          })
          if (rows.length > 0) {
            const { error: insErr } = await supabase.from('online_sessions').insert(rows)
            if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
            sessionsRegenerated = rows.length
          }
        }
      }
    }

    return NextResponse.json({ ok: true, sessions_regenerated: sessionsRegenerated, sessions_tutor_synced: sessionsTutorSynced })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
