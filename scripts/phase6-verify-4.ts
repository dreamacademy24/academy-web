import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NAMES = ['신세하', '신건하', '박도유', '박나은']
const WD = ['일', '월', '화', '수', '목', '금', '토']

async function run() {
  const { data: enrolls } = await supabase
    .from('online_enrollments')
    .select('id, student_name, class_period, days_of_week, class_time_kr, start_date, end_date, pre_sessions, post_sessions, total_sessions, notes')
    .in('student_name', NAMES)
    .order('student_name')
  const ids = (enrolls || []).map(e => e.id)
  const { data: sess } = await supabase
    .from('online_sessions')
    .select('enrollment_id, scheduled_date, status')
    .in('enrollment_id', ids)
    .order('scheduled_date')
  const byEnr: Record<string, any[]> = {}
  ;(sess || []).forEach(s => {
    if (!byEnr[s.enrollment_id]) byEnr[s.enrollment_id] = []
    byEnr[s.enrollment_id].push(s)
  })

  console.log('═══════════════════════════════════════════════════════════')
  console.log('[1] 4명 total == actual 검증')
  console.log('═══════════════════════════════════════════════════════════')
  ;(enrolls || []).forEach(e => {
    const actual = (byEnr[e.id] || []).length
    const ok = actual === e.total_sessions
    console.log(`  ${ok ? '✅' : '⚠️'} ${e.student_name.padEnd(6)} total=${e.total_sessions} actual=${actual} | period=${e.class_period} days=${(e.days_of_week || []).join('')} time=${e.class_time_kr} ${e.start_date}~${e.end_date}`)
  })

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('[2] 메이 체크용 세션 날짜')
  console.log('═══════════════════════════════════════════════════════════')
  for (const name of NAMES) {
    const e = (enrolls || []).find(x => x.student_name === name)
    if (!e) { console.log(`\n▶ ${name}: enrollment 없음`); continue }
    const list = (byEnr[e.id] || []).slice().sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    console.log(`\n▶ ${name} — ${list.length}회 (${(e.days_of_week || []).map((d: string) => ({mon:'월',tue:'화',wed:'수',thu:'목',fri:'금',sat:'토'} as any)[d] || d).join('/')}, ${e.class_time_kr})`)
    console.log(`   ${e.start_date} ~ ${e.end_date} | period=${e.class_period} | pre=${e.pre_sessions} post=${e.post_sessions} total=${e.total_sessions}`)
    const fmt = list.map(s => {
      const wd = WD[new Date(s.scheduled_date + 'T00:00:00').getDay()]
      return `${s.scheduled_date.slice(5).replace('-', '/')}(${wd})`
    })
    console.log(`   ${fmt.join(', ')}`)
    console.log(`   notes: ${e.notes}`)
  }

  const { count: total } = await supabase.from('online_sessions').select('*', { count: 'exact', head: true })
  console.log(`\n═══════════════════════════════════════════════════════════`)
  console.log(`online_sessions 전체: ${total}건`)
}
run().catch(console.error)
