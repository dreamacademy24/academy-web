import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { buildOnlineSessionDates } from '@/lib/onlineClassSchedule'

function krToPh(kr: string | null): string | null {
  if (!kr || !/^\d{1,2}:\d{2}/.test(kr)) return null
  const [h, m] = kr.split(':').map(Number)
  return `${String((h + 23) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

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
  const unassigned = searchParams.get('unassigned') === 'true'
  if (unassigned) q = q.is('tutor_id', null).in('status', ['active', 'scheduled'])

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  let rows = data ?? []
  // 미배정 목록: 잔여 회차 있는 수강권만 (종료일 지나도 회차 남으면 표시)
  if (unassigned) rows = rows.filter((e: any) => ((e.total_sessions || 0) - (e.used_sessions || 0)) > 0)
  // 연수기간(체류) 부착 — 기간 컬럼 '연수/화상' 2개념 표시용
  if (searchParams.get('include_stays') === '1' && rows.length) {
    const { data: bks } = await supabase.from('bookings')
      .select('checkin_date, checkout_date, students, portal_user_id, status').neq('status', '취소')
    const parsed = (bks || []).filter(b => b.checkin_date && b.checkout_date).map(b => {
      let arr: unknown = b.students
      if (typeof arr === 'string') { try { arr = JSON.parse(arr) } catch { arr = [] } }
      const names = Array.isArray(arr) ? arr.map((st: any) => (st.korName || st.name_kr || st.name || '').trim()).filter(Boolean) : []
      return { ci: b.checkin_date, co: b.checkout_date, names, uid: b.portal_user_id }
    })
    rows = rows.map((e: any) => ({
      ...e,
      stays: parsed.filter(b => (e.customer_user_id && b.uid === e.customer_user_id) || (e.student_name && b.names.includes(e.student_name.trim())))
        .map(b => ({ from: b.ci, to: b.co })).sort((a, b) => a.from.localeCompare(b.from)),
    }))
  }
  return NextResponse.json({ enrollments: rows })
}

// 요일 매핑
const DAY_MAP: Record<string, number> = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 }



// ── 티쳐 시간 중복 방지 (핵심 안전장치) ──
// 같은 티쳐 + 겹치는 요일 + 같은 시간 + 수강기간 겹침 → 배정 차단
const _DN: Record<string, string> = { mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri', sat: 'sat', sun: 'sun', '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', '금': 'fri', '토': 'sat', '일': 'sun' }
function _nd(d: string): string { return _DN[String(d).toLowerCase()] || String(d).toLowerCase() }
function _nt(t: string | null): string | null {
  if (!t) return null
  const m = String(t).match(/(\d{1,2})[:시](\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : String(t)
}
async function findTutorConflict(tutorId: string, enr: { id?: string; days_of_week?: string[]; class_time_kr?: string | null; day_times?: Record<string, string> | null; start_date?: string | null; end_date?: string | null }): Promise<string | null> {
  if (!tutorId) return null
  const { data: others } = await supabase.from('online_enrollments')
    .select('id, student_name, days_of_week, class_time_kr, day_times, start_date, end_date, status')
    .eq('tutor_id', tutorId).in('status', ['active', 'scheduled'])
  const myDays = (enr.days_of_week || []).map(_nd)
  const myTimeOf = (d: string) => _nt((enr.day_times && (enr.day_times as any)[Object.keys(_DN).find(k => _nd(k) === d && k.length === 1) || ''] ) || enr.class_time_kr || null)
  const aS = enr.start_date || '0000', aE = enr.end_date || '9999'
  for (const o of (others || [])) {
    if (enr.id && o.id === enr.id) continue
    const bS = o.start_date || '0000', bE = o.end_date || '9999'
    if (aS > bE || bS > aE) continue // 기간 안 겹침
    const oDays = (o.days_of_week || []).map(_nd)
    for (const d of myDays) {
      if (!oDays.includes(d)) continue
      const t1 = myTimeOf(d)
      const kr = Object.keys(_DN).find(k => _nd(k) === d && k.length === 1) || ''
      const t2 = _nt((o.day_times && (o.day_times as any)[kr]) || o.class_time_kr || null)
      if (t1 && t2 && t1 === t2) return `${o.student_name} (${d.toUpperCase()} ${t1})`
    }
  }
  return null
}

// 학생의 세부 체류기간(향후 예약) 조회 — 화상영어 세션 생성 시 자동 제외 (재방문 대응)
async function loadStayRanges(customerUserId: string | null, studentName: string | null): Promise<{ from: string; to: string }[]> {
  try {
    const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
    let q = supabase.from('bookings').select('checkin_date, checkout_date, students, portal_user_id, status')
      .gte('checkout_date', today).neq('status', '취소')
    const { data } = await q
    const ranges: { from: string; to: string }[] = []
    for (const b of (data || [])) {
      if (!b.checkin_date || !b.checkout_date) continue
      let match = false
      if (customerUserId && b.portal_user_id === customerUserId) match = true
      if (!match && studentName) {
        let arr: unknown = b.students
        if (typeof arr === 'string') { try { arr = JSON.parse(arr) } catch { arr = [] } }
        if (Array.isArray(arr)) match = arr.some((st: any) => ((st.korName || st.name_kr || st.name || '').trim() === studentName.trim()))
      }
      if (match) ranges.push({ from: b.checkin_date, to: b.checkout_date })
    }
    return ranges
  } catch { return [] }
}

async function loadHolidaySet(): Promise<Set<string>> {
  try {
    const { data } = await supabase.from('holidays').select('date').eq('is_deployed', true)
    return new Set((data || []).map((h: { date: string }) => h.date))
  } catch { return new Set() }
}

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
    if (tutor_id) {
      const conflict = await findTutorConflict(tutor_id, { days_of_week, class_time_kr, day_times: day_times || null, start_date, end_date })
      if (conflict) return NextResponse.json({ error: `⛔ 티쳐 시간 중복: 이미 ${conflict} 수업이 있어요. 다른 시간/티쳐를 선택하세요.` }, { status: 409 })
    }
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
        class_time_ph: class_time_ph || krToPh(class_time_kr || null), // PH = KR-1h 자동
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
    const holidaySet = await loadHolidaySet()
    const _stays = await loadStayRanges(customer_user_id || null, student_name || null)
    const _built = buildOnlineSessionDates(start_date, days_of_week, Number(total_sessions), holidaySet, _stays)
    const sessionDates = _built.dates
    // 실제 마지막 회차로 종료일 보정 (성수기/방학·휴일 제외 반영)
    if (_built.endDate && _built.endDate !== end_date) {
      await supabase.from('online_enrollments').update({ end_date: _built.endDate }).eq('id', enrollment.id)
    }

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
    const allowed = ['student_name','student_name_en','student_birth_year','tutor_id','days_of_week','class_time_kr','class_time_ph','start_date','end_date','duration_weeks','class_duration_weeks','pre_sessions','post_sessions','total_sessions','sessions_per_week','status','notes','level','enrollment_type','class_period','day_times','portal_open','customer_user_id']
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

    // 티쳐 시간 중복 하드 블록: 배정될(또는 유지될) 티쳐 기준으로 최종 스케줄 검사
    {
      const { data: cur } = await supabase.from('online_enrollments')
        .select('id, tutor_id, days_of_week, class_time_kr, day_times, start_date, end_date').eq('id', id).single()
      const effTutor = ('tutor_id' in updates ? updates.tutor_id : cur?.tutor_id) as string | null
      if (effTutor) {
        const eff = {
          id,
          days_of_week: ('days_of_week' in updates ? updates.days_of_week : cur?.days_of_week) as string[],
          class_time_kr: ('class_time_kr' in updates ? updates.class_time_kr : cur?.class_time_kr) as string | null,
          day_times: ('day_times' in updates ? updates.day_times : cur?.day_times) as Record<string, string> | null,
          start_date: ('start_date' in updates ? updates.start_date : cur?.start_date) as string | null,
          end_date: ('end_date' in updates ? updates.end_date : cur?.end_date) as string | null,
        }
        const conflict = await findTutorConflict(effTutor, eff)
        if (conflict) return NextResponse.json({ error: `⛔ 티쳐 시간 중복: 이미 ${conflict} 수업이 있어요. 다른 시간/티쳐를 선택하세요.` }, { status: 409 })
      }
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

          const _hs = await loadHolidaySet()
          const _stays2 = await loadStayRanges(enroll.customer_user_id || null, enroll.student_name || null)
          const dates = buildOnlineSessionDates(startFrom, enroll.days_of_week, needed, _hs, _stays2).dates
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
            // 종료일 = 실제 마지막 회차 (체류·방학·휴일 제외 반영)
            await supabase.from('online_enrollments').update({ end_date: rows[rows.length - 1].scheduled_date }).eq('id', id)
          }
        }
      }
    }

    return NextResponse.json({ ok: true, sessions_regenerated: sessionsRegenerated, sessions_tutor_synced: sessionsTutorSynced })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
