import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TARGET_NAMES = ['주예솔', '주은솔', '신세하', '신건하', '윤준서', '윤영서']

/*
컬럼 매핑 (요청 → 실제):
  name_kr/name_ko  → student_name
  days             → days_of_week
  time             → class_time_kr
  period_start/end → start_date/end_date
  total            → total_sessions
  completed        → used_sessions
  class_type       → class_period  (값: pre/post/both)
  session_date     → scheduled_date
  pre/regular 구분  → class_period + pre_sessions/post_sessions
*/

async function run() {
  console.log('===============================================')
  console.log('STEP 1. online_enrollments 조회 — 대상 6명')
  console.log('===============================================')

  const { data: enrolls, error: eErr } = await supabase
    .from('online_enrollments')
    .select('id, student_name, student_name_en, tutor_id, days_of_week, class_time_kr, start_date, end_date, total_sessions, used_sessions, class_period, pre_sessions, post_sessions, notes, created_at')
    .in('student_name', TARGET_NAMES)
    .order('student_name')
    .order('created_at', { ascending: true })

  if (eErr) { console.log('❌', eErr.message); return }

  const byName: Record<string, any[]> = {}
  ;(enrolls || []).forEach(e => {
    if (!byName[e.student_name]) byName[e.student_name] = []
    byName[e.student_name].push(e)
  })

  console.log('\n===============================================')
  console.log('STEP 2. online_sessions 집계 — 각 enrollment 별')
  console.log('===============================================')

  const allIds = (enrolls || []).map(e => e.id)
  const sessionStats: Record<string, { total: number; attended: number; scheduled: number; first: string | null; last: string | null }> = {}
  if (allIds.length > 0) {
    const { data: sess, error: sErr } = await supabase
      .from('online_sessions')
      .select('enrollment_id, scheduled_date, status')
      .in('enrollment_id', allIds)
    if (sErr) { console.log('❌', sErr.message); return }
    for (const s of (sess || [])) {
      if (!sessionStats[s.enrollment_id]) sessionStats[s.enrollment_id] = { total: 0, attended: 0, scheduled: 0, first: null, last: null }
      const st = sessionStats[s.enrollment_id]
      st.total++
      if (s.status === 'attended') st.attended++
      if (s.status === 'scheduled') st.scheduled++
      if (!st.first || s.scheduled_date < st.first) st.first = s.scheduled_date
      if (!st.last || s.scheduled_date > st.last) st.last = s.scheduled_date
    }
  }

  console.log('\n===============================================')
  console.log('STEP 3. 학생별 상세 결과')
  console.log('===============================================')

  for (const name of TARGET_NAMES) {
    const list = byName[name] || []
    console.log(`\n▶ ${name}`)
    if (!list.length) {
      console.log('   ⚠️ enrollment 없음')
      continue
    }
    list.forEach((e, idx) => {
      const st = sessionStats[e.id] || { total: 0, attended: 0, scheduled: 0, first: null, last: null }
      const lacked = e.total_sessions - st.total
      const status =
        e.class_period === 'pre' && st.total < e.total_sessions ? '🔴 pre 세션 누락' :
        e.class_period === 'both' && st.total < e.total_sessions ? '🟡 both/일부 누락' :
        st.total < e.total_sessions ? `⚠️ 세션 ${lacked}개 부족` : '✅'

      console.log(`   [${idx + 1}] id=${e.id}`)
      console.log(`       class_period=${e.class_period}  (pre=${e.pre_sessions}, post=${e.post_sessions}, total=${e.total_sessions})`)
      console.log(`       tutor_id=${e.tutor_id || 'null'}  days=${(e.days_of_week || []).join('/')}  time=${e.class_time_kr}`)
      console.log(`       period=${e.start_date} ~ ${e.end_date}`)
      console.log(`       sessions: ${st.total}개 (attended=${st.attended}, scheduled=${st.scheduled})  first=${st.first || '-'}  last=${st.last || '-'}`)
      console.log(`       notes: ${e.notes || '-'}`)
      console.log(`       판정: ${status}`)
    })
  }

  console.log('\n===============================================')
  console.log('STEP 4. 판정 요약')
  console.log('===============================================')
  let needPre = 0, needMore = 0, enough = 0
  for (const name of TARGET_NAMES) {
    const list = byName[name] || []
    const hasPreEnr = list.some(e => e.class_period === 'pre')
    const bothEnr = list.find(e => e.class_period === 'both')
    if (!hasPreEnr && bothEnr && bothEnr.pre_sessions > 0) {
      console.log(`   ${name}: both 1건 (pre_sessions=${bothEnr.pre_sessions}, post_sessions=${bothEnr.post_sessions}) — 전(pre) 세션이 생성됐는지 확인 필요`)
    } else if (hasPreEnr) {
      console.log(`   ${name}: pre 별도 enrollment 있음`)
    } else {
      console.log(`   ${name}: enrollment 구조 ${list.map(e => e.class_period).join(',')}`)
    }
  }
}

run().catch(console.error)
