import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 요일 한→영 변환
function parseDays(days: string): string[] {
  const map: Record<string, string> = {
    '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', '금': 'fri', '토': 'sat'
  }
  return days.replace(/\s/g, '').split('').filter(d => map[d]).map(d => map[d])
}

// 튜터명 → staff_user_id 매핑
const tutorMap: Record<string, string> = {
  'Ann': 'admin-ann',
  'Amelyn': 'admin-amelyn',
  'Carla': 'admin-carla',
  'Angel': 'admin-angel',
  'Cristel': 'admin-cristel',
}

// 확정된 학생 데이터 (요일+시간+날짜 모두 있는 것만)
const students = [
  // 이채현은 이미 DB에 있으므로 스킵
  { name: '심시우', name_en: 'Shim Siu', age: '16년생', tutor: 'Amelyn', days: '월수금', time_kr: '21:00', time_ph: '20:00', start: '2026-03-02', end: '2026-03-27', period: 4, class_period: 'post', sessions_pw: 3, pre: 0, post: 48, total: 48, notes: '후(04.06~07.10 / 08.31~09.21) 시아 24회 추가' },
  { name: '신도현', name_en: 'Shin Dohyeon', age: '20년생', tutor: 'Carla', days: '화수목', time_kr: '19:30', time_ph: '18:30', start: '2026-03-30', end: '2026-04-24', period: 4, class_period: 'post', sessions_pw: 3, pre: 0, post: 24, total: 24, notes: '후(04.29~06.23)' },
  { name: '최우주', name_en: 'Choi Uju', age: '20년생', tutor: 'Angel', days: '월수금', time_kr: '20:30', time_ph: '19:30', start: '2026-03-30', end: '2026-04-24', period: 4, class_period: 'post', sessions_pw: 3, pre: 0, post: 24, total: 24, notes: '후(04.29~06.29)' },
  { name: '이다은', name_en: 'Lee Daeun', age: '18년생', tutor: 'Carla', days: '월수금', time_kr: '18:00', time_ph: '17:00', start: '2026-04-06', end: '2026-05-01', period: 4, class_period: 'both', sessions_pw: 3, pre: 7, post: 17, total: 24, notes: '전(03.16~04.03) 후(05.04~06.15)' },
  { name: '전가빈', name_en: 'Jeon Gavin', age: '19년생', tutor: 'Ann', days: '수', time_kr: '19:30', time_ph: '18:30', start: '2026-04-06', end: '2026-05-01', period: 4, class_period: 'both', sessions_pw: 1, pre: 3, post: 21, total: 24, notes: '전(03.18~04.01) 후(05.06~11.11) 주1회' },
  { name: '최다온', name_en: 'Choi Daon', age: '18년생', tutor: 'Amelyn', days: '화수목', time_kr: '18:30', time_ph: '17:30', start: '2026-04-13', end: '2026-05-01', period: 3, class_period: 'both', sessions_pw: 3, pre: 6, post: 12, total: 18, notes: '전(03.17~03.26) 후(05.05~05.28) Cristel→Amelyn' },
  { name: '최다인', name_en: 'Choi Dain', age: '22년생', tutor: 'Angel', days: '화수목', time_kr: '19:00', time_ph: '18:00', start: '2026-04-13', end: '2026-05-01', period: 3, class_period: 'both', sessions_pw: 3, pre: 1, post: 17, total: 18, notes: '전(03.17) 후(05.05~06.10)' },
  { name: '최서준', name_en: 'Choi Joon', age: '18년생', tutor: 'Carla', days: '월목', time_kr: '17:30', time_ph: '16:30', start: '2026-04-13', end: '2026-04-24', period: 2, class_period: 'both', sessions_pw: 2, pre: 2, post: 8, total: 10, notes: '전(04.06~04.09) 후(05.04~05.28) 주2회' },
  { name: '허지안', name_en: 'Heo Jian(Luna)', age: '21년생', tutor: 'Carla', days: '월수금', time_kr: '16:30', time_ph: '15:30', start: '2026-04-20', end: '2026-05-15', period: 4, class_period: 'both', sessions_pw: 3, pre: 6, post: 18, total: 24, notes: '전(03.23~04.06) 후(05.18~07.01) 월금16:30 수19:30' },
  { name: '주예솔', name_en: 'Ju Yesol', age: '16년생', tutor: 'Ann', days: '월수금', time_kr: '20:00', time_ph: '19:00', start: '2026-04-27', end: '2026-05-08', period: 2, class_period: 'both', sessions_pw: 3, pre: 6, post: 6, total: 12, notes: '전(04.13~04.24) 후(05.18~06.01)' },
  { name: '주은솔', name_en: 'Ju Eunsol', age: '18년생', tutor: 'Angel', days: '월수금', time_kr: '20:30', time_ph: '19:30', start: '2026-04-27', end: '2026-05-08', period: 2, class_period: 'both', sessions_pw: 3, pre: 6, post: 6, total: 12, notes: '전(04.13~04.24) 후(05.18~06.01)' },
  { name: '신세하', name_en: 'Shin Seha', age: '15년생', tutor: 'Carla', days: '월수금', time_kr: '21:00', time_ph: '20:00', start: '2026-04-27', end: '2026-05-08', period: 2, class_period: 'both', sessions_pw: 3, pre: 6, post: 6, total: 12, notes: '전(04.13~04.24) 후(05.12~05.23)' },
  { name: '신건하', name_en: 'Shin Geonha', age: '18년생', tutor: 'Carla', days: '월수금', time_kr: '19:00', time_ph: '18:00', start: '2026-04-27', end: '2026-05-08', period: 2, class_period: 'both', sessions_pw: 3, pre: 6, post: 6, total: 12, notes: '전(04.13~04.24) 후(05.12~05.23)' },
  { name: '임지유', name_en: 'Im Jiyoo', age: '16년생', tutor: 'Carla', days: '월수목', time_kr: '20:30', time_ph: '19:30', start: '2026-04-27', end: '2026-05-22', period: 4, class_period: 'both', sessions_pw: 3, pre: 6, post: 18, total: 24, notes: '전(04.13~04.23) 후(05.25~07.02)' },
  { name: '임서준', name_en: 'Im Seojun', age: '20년생', tutor: 'Angel', days: '월수목', time_kr: '20:00', time_ph: '19:00', start: '2026-04-27', end: '2026-05-22', period: 4, class_period: 'both', sessions_pw: 3, pre: 6, post: 18, total: 24, notes: '전(04.13~04.23) 후(05.25~07.02)' },
  { name: '정윤후', name_en: 'Jeong Yunhu', age: '16년생', tutor: 'Amelyn', days: '화수목', time_kr: '20:30', time_ph: '19:30', start: '2026-04-27', end: '2026-05-22', period: 4, class_period: 'both', sessions_pw: 3, pre: 6, post: 18, total: 24, notes: '전(04.14~04.23) 후(05.26~07.02)' },
  { name: '김은우', name_en: 'Kim Eunwoo', age: '18년생', tutor: 'Angel', days: '월화목', time_kr: '19:30', time_ph: '18:30', start: '2026-05-11', end: '2026-06-05', period: 4, class_period: 'both', sessions_pw: 3, pre: 12, post: 12, total: 24, notes: '전(04.06~05.01) 후(06.15~07.09)' },
  { name: '최서우', name_en: 'Choi Seou', age: '20년생', tutor: 'Carla', days: '화목토', time_kr: '19:30', time_ph: '18:30', start: '2026-05-11', end: '2026-07-03', period: 8, class_period: 'both', sessions_pw: 3, pre: 16, post: 32, total: 48, notes: '후(09.01~12.22) 화목19:30 토11:30' },
  { name: '최은우', name_en: 'Choi Eunu', age: '21년생', tutor: 'Ann', days: '화목토', time_kr: '19:00', time_ph: '18:00', start: '2026-05-11', end: '2026-07-03', period: 8, class_period: 'both', sessions_pw: 3, pre: 16, post: 32, total: 48, notes: '후(09.01~12.22) 화목19:00 토11:00' },
  { name: '임세아', name_en: 'Im Sea', age: '18년생', tutor: 'Carla', days: '월화목', time_kr: '20:00', time_ph: '19:00', start: '2026-05-25', end: '2026-06-19', period: 4, class_period: 'both', sessions_pw: 3, pre: 6, post: 18, total: 24, notes: '전(05.11~05.21) 후(06.22~07.09 / 08.31~09.17)' },
  { name: '임태양', name_en: 'Taeyang', age: '16년생', tutor: 'Angel', days: '월수금', time_kr: '21:00', time_ph: '20:00', start: '2026-06-22', end: '2026-07-17', period: 4, class_period: 'both', sessions_pw: 3, pre: 15, post: 9, total: 24, notes: '전(05.11~06.17) 후(08.31~09.18)' },
  { name: '윤준서', name_en: 'Yoon Junseo', age: '19년생', tutor: 'Angel', days: '월금', time_kr: '18:00', time_ph: '17:00', start: '2026-07-06', end: '2026-07-24', period: 3, class_period: 'pre', sessions_pw: 2, pre: 18, post: 0, total: 18, notes: '전(04.06~06.15)' },
  { name: '윤영서', name_en: 'Yoon Youngseo', age: '19년생', tutor: 'Amelyn', days: '화목', time_kr: '19:00', time_ph: '18:00', start: '2026-07-06', end: '2026-07-24', period: 3, class_period: 'pre', sessions_pw: 2, pre: 18, post: 0, total: 18, notes: '전(04.07~06.04)' },
  { name: '이서준', name_en: 'Lee Seojun(Evan)', age: '19년생', tutor: 'Angel', days: '월수토', time_kr: '20:00', time_ph: '19:00', start: '2026-07-27', end: '2026-08-20', period: 4, class_period: 'post', sessions_pw: 3, pre: 0, post: 12, total: 12, notes: '후(08.31~09.26) 월수20:00 토10:00' },
  { name: '서하연', name_en: 'Seo Hayeon', age: '15년생', tutor: 'Amelyn', days: '월수금', time_kr: '20:30', time_ph: '19:30', start: '2026-07-27', end: '2026-08-14', period: 3, class_period: 'post', sessions_pw: 3, pre: 0, post: 18, total: 18, notes: '후(09.07~10.16)' },
  { name: '서예나', name_en: 'Seo Yena', age: '18년생', tutor: 'Ann', days: '월수금', time_kr: '20:00', time_ph: '19:00', start: '2026-07-27', end: '2026-08-14', period: 3, class_period: 'post', sessions_pw: 3, pre: 0, post: 18, total: 18, notes: '후(09.07~10.16)' },
  { name: '서은준', name_en: 'Seo Eunjun', age: '19년생', tutor: 'Ann', days: '월수금', time_kr: '19:30', time_ph: '18:30', start: '2026-07-27', end: '2026-08-14', period: 3, class_period: 'post', sessions_pw: 3, pre: 0, post: 18, total: 18, notes: '후(09.07~10.16)' },
  { name: '박도유', name_en: 'Park Doyoo', age: '14년생', tutor: null, days: '월화목', time_kr: '19:30', time_ph: '18:30', start: '2026-08-17', end: '2026-08-28', period: 2, class_period: 'post', sessions_pw: 3, pre: 0, post: 12, total: 12, notes: '후(09.01~09.21)' },
  { name: '박나은', name_en: 'Park Naeun', age: '17년생', tutor: null, days: '월화목', time_kr: '19:00', time_ph: '18:00', start: '2026-08-17', end: '2026-08-28', period: 2, class_period: 'post', sessions_pw: 3, pre: 0, post: 12, total: 12, notes: '후(09.01~09.21)' },
  { name: '박태양', name_en: 'Park Taeyang', age: '19년생', tutor: null, days: '월화금', time_kr: '20:00', time_ph: '19:00', start: '2026-11-02', end: '2026-11-27', period: 4, class_period: 'both', sessions_pw: 3, pre: 20, post: 4, total: 24, notes: '전(09.14~10.27) 후(11.30~12.07)' },
  { name: '백승우', name_en: 'Back Seungyou', age: '19년생', tutor: null, days: '월수목', time_kr: '19:30', time_ph: '18:30', start: '2026-11-02', end: '2026-11-27', period: 4, class_period: 'both', sessions_pw: 3, pre: 21, post: 3, total: 24, notes: '전(09.14~10.29) 후(11.30~12.03)' },
  { name: '백채은', name_en: 'Back Chaeeun', age: '22년생', tutor: null, days: '월수목', time_kr: '19:00', time_ph: '18:00', start: '2026-11-02', end: '2026-11-27', period: 4, class_period: 'both', sessions_pw: 3, pre: 21, post: 3, total: 24, notes: '전(09.14~10.29) 후(11.30~12.03)' },
]

async function seed() {
  // 튜터 ID 조회
  const { data: tutors } = await supabase.from('online_tutors').select('id, name_en, staff_user_id')
  const getTutorId = (name: string | null) => {
    if (!name) return null
    const staffId = tutorMap[name]
    return tutors?.find(t => t.staff_user_id === staffId)?.id || null
  }

  let success = 0, skip = 0, error = 0

  for (const s of students) {
    // 중복 체크
    const { data: existing } = await supabase
      .from('online_enrollments')
      .select('id')
      .eq('student_name', s.name)
      .eq('start_date', s.start)
      .maybeSingle()

    if (existing) {
      console.log(`⏭️  스킵: ${s.name} (${s.start}) - 이미 존재`)
      skip++
      continue
    }

    const tutorId = getTutorId(s.tutor)
    const daysArr = parseDays(s.days)

    // enrollment INSERT
    const { data: enr, error: enrErr } = await supabase
      .from('online_enrollments')
      .insert({
        student_name: s.name,
        student_name_en: s.name_en,
        student_birth_year: s.age,
        tutor_id: tutorId,
        enrollment_type: 'free_package',
        days_of_week: daysArr,
        class_time_kr: s.time_kr,
        class_time_ph: s.time_ph,
        start_date: s.start,
        end_date: s.end,
        duration_weeks: s.period,
        class_duration_weeks: s.period * 2,
        class_period: s.class_period,
        sessions_per_week: s.sessions_pw,
        total_sessions: s.total,
        pre_sessions: s.pre,
        post_sessions: s.post,
        status: 'active',
        notes: s.notes
      })
      .select()
      .single()

    if (enrErr || !enr) {
      console.error(`❌ 에러: ${s.name}`, enrErr?.message)
      error++
      continue
    }

    // 세션 자동생성
    const sessions = []
    const dayNums: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 }
    let sessionNum = 1
    const startDate = new Date(s.start)
    const endDate = new Date(s.end)
    const cur = new Date(startDate)

    while (cur <= endDate && sessionNum <= s.total) {
      const dayOfWeek = cur.getDay()
      const dayName = Object.entries(dayNums).find(([, n]) => n === dayOfWeek)?.[0]
      if (dayName && daysArr.includes(dayName)) {
        sessions.push({
          enrollment_id: enr.id,
          tutor_id: tutorId,
          session_number: sessionNum,
          scheduled_date: cur.toISOString().split('T')[0],
          scheduled_time_kr: s.time_kr,
          scheduled_time_ph: s.time_ph,
          status: 'scheduled'
        })
        sessionNum++
      }
      cur.setDate(cur.getDate() + 1)
    }

    if (sessions.length > 0) {
      const { error: sessErr } = await supabase.from('online_sessions').insert(sessions)
      if (sessErr) {
        console.error(`❌ 세션 에러: ${s.name}`, sessErr.message)
      }
    }

    console.log(`✅ 완료: ${s.name} (${s.name_en}) - ${sessions.length}개 세션 생성`)
    success++
  }

  console.log(`\n=== 완료 ===`)
  console.log(`✅ 성공: ${success}명`)
  console.log(`⏭️  스킵: ${skip}명 (중복)`)
  console.log(`❌ 에러: ${error}명`)
}

seed().catch(console.error)
