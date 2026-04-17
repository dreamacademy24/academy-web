import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Plan {
  name: string
  classPeriod: 'pre' | 'post' | 'both'
  days: string[]
  timeKr: string
  timePh: string
  preStart?: string; preEnd?: string
  postStart?: string; postEnd?: string
  preSessions: number; postSessions: number; totalSessions: number
  startDate: string; endDate: string
  notes: string
}

const PLANS: Plan[] = [
  {
    name: '신세하',
    classPeriod: 'both', days: ['mon', 'wed', 'fri'], timeKr: '21:00', timePh: '20:00',
    preStart: '2026-04-13', preEnd: '2026-04-24',
    postStart: '2026-05-12', postEnd: '2026-05-25',
    preSessions: 6, postSessions: 6, totalSessions: 12,
    startDate: '2026-04-13', endDate: '2026-05-25',
    notes: '전(04.13~04.24) 후(05.12~05.25) 월수금 21:00',
  },
  {
    name: '신건하',
    classPeriod: 'both', days: ['mon', 'wed', 'fri'], timeKr: '19:00', timePh: '18:00',
    preStart: '2026-04-13', preEnd: '2026-04-24',
    postStart: '2026-05-12', postEnd: '2026-05-25',
    preSessions: 6, postSessions: 6, totalSessions: 12,
    startDate: '2026-04-13', endDate: '2026-05-25',
    notes: '전(04.13~04.24) 후(05.12~05.25) 월수금 19:00',
  },
  {
    name: '박도유',
    classPeriod: 'post', days: ['mon', 'tue', 'thu'], timeKr: '19:30', timePh: '18:30',
    postStart: '2026-09-01', postEnd: '2026-09-28',
    preSessions: 0, postSessions: 12, totalSessions: 12,
    startDate: '2026-09-01', endDate: '2026-09-28',
    notes: '후(09.01~09.28) 월화목 19:30',
  },
  {
    name: '박나은',
    classPeriod: 'post', days: ['mon', 'tue', 'thu'], timeKr: '19:00', timePh: '18:00',
    postStart: '2026-09-01', postEnd: '2026-09-28',
    preSessions: 0, postSessions: 12, totalSessions: 12,
    startDate: '2026-09-01', endDate: '2026-09-28',
    notes: '후(09.01~09.28) 월화목 19:00',
  },
]

const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const WD_KR = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n: number) => String(n).padStart(2, '0')
function localDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

function enumerate(start: string, end: string, days: string[], holidaySet: Set<string>) {
  const out: Array<{ date: string; wd: string }> = []
  const d = new Date(start + 'T00:00:00')
  const ed = new Date(end + 'T00:00:00')
  while (d <= ed) {
    const wd = WD[d.getDay()]
    if (days.includes(wd)) {
      const ds = localDateStr(d)
      if (!holidaySet.has(ds)) out.push({ date: ds, wd })
    }
    d.setDate(d.getDate() + 1)
  }
  return out
}

const q = (v: string | null | undefined) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`

async function run() {
  // holidays 로드
  const { data: holidays } = await supabase.from('online_class_holidays').select('holiday_date')
  const holidaySet = new Set((holidays || []).map(h => h.holiday_date))
  console.log(`휴강 리스트 로드: ${holidaySet.size}건`)

  // enrollments 로드
  const names = PLANS.map(p => p.name)
  const { data: enrolls } = await supabase
    .from('online_enrollments')
    .select('id, student_name, tutor_id, class_time_kr, class_time_ph')
    .in('student_name', names)
  const byName: Record<string, any> = {}
  ;(enrolls || []).forEach(e => { byName[e.student_name] = e })

  // 각 학생별 세션 계산
  const planDates: Record<string, Array<{ date: string; wd: string }>> = {}
  for (const p of PLANS) {
    const list: Array<{ date: string; wd: string }> = []
    if (p.preStart && p.preEnd) list.push(...enumerate(p.preStart, p.preEnd, p.days, holidaySet))
    if (p.postStart && p.postEnd) list.push(...enumerate(p.postStart, p.postEnd, p.days, holidaySet))
    planDates[p.name] = list
    if (list.length !== p.totalSessions) {
      console.log(`❌ ${p.name}: 계산 ${list.length} ≠ 기대 ${p.totalSessions} — 실행 중단`)
      return
    }
  }

  // SQL 조립
  const targetIds = PLANS.map(p => byName[p.name]?.id).filter(Boolean)
  const inner: string[] = []
  inner.push(`DELETE FROM online_sessions WHERE enrollment_id IN (${targetIds.map(q).join(', ')});`)
  for (const p of PLANS) {
    const e = byName[p.name]; if (!e) continue
    const daysArr = `ARRAY[${p.days.map(q).join(',')}]::text[]`
    inner.push(`UPDATE online_enrollments SET
      class_period=${q(p.classPeriod)},
      days_of_week=${daysArr},
      class_time_kr=${q(p.timeKr)},
      class_time_ph=${q(p.timePh)},
      start_date=${q(p.startDate)},
      end_date=${q(p.endDate)},
      pre_sessions=${p.preSessions},
      post_sessions=${p.postSessions},
      total_sessions=${p.totalSessions},
      used_sessions=0,
      notes=${q(p.notes)}
      WHERE id=${q(e.id)};`)

    const rows = planDates[p.name].map((s, idx) =>
      `(${q(e.id)}, ${q(e.tutor_id)}, ${idx + 1}, '${s.date}', ${q(p.timeKr)}, ${q(p.timePh)}, 'scheduled')`
    )
    inner.push(`INSERT INTO online_sessions (enrollment_id, tutor_id, session_number, scheduled_date, scheduled_time_kr, scheduled_time_ph, status) VALUES\n${rows.join(',\n')};`)
  }

  const fullSql = `DO $do$\nBEGIN\n${inner.join('\n')}\nEND $do$;`

  console.log('\n[트랜잭션 요약]')
  console.log(`• 대상 4명: ${PLANS.map(p => p.name).join(', ')}`)
  console.log(`• DELETE enrollments: ${targetIds.length}건`)
  console.log(`• UPDATE: 4건`)
  console.log(`• INSERT sessions: ${Object.values(planDates).reduce((a, b) => a + b.length, 0)}개`)
  console.log(`• SQL 길이: ${fullSql.length} chars`)

  console.log('\n🚀 실행...')
  const { error } = await supabase.rpc('exec_sql', { sql: fullSql })
  if (error) { console.log('❌ 실패 (자동 롤백):', error.message); return }
  console.log('✅ COMMIT 완료')

  // ═══════════ 검증 ═══════════
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('검증')
  console.log('═══════════════════════════════════════════════════════════')

  const { data: verify } = await supabase
    .from('online_enrollments')
    .select('id, student_name, pre_sessions, post_sessions, total_sessions')
    .in('id', targetIds)
    .order('student_name')

  const { data: cur } = await supabase
    .from('online_sessions')
    .select('enrollment_id, scheduled_date, scheduled_time_kr, status')
    .in('enrollment_id', targetIds)
    .order('scheduled_date')

  const cnt: Record<string, any[]> = {}
  ;(cur || []).forEach(s => {
    if (!cnt[s.enrollment_id]) cnt[s.enrollment_id] = []
    cnt[s.enrollment_id].push(s)
  })

  console.log('\n[1] total == actual')
  ;(verify || []).forEach(e => {
    const actual = (cnt[e.id] || []).length
    const ok = actual === e.total_sessions
    console.log(`  ${ok ? '✅' : '⚠️'} ${e.student_name}  total=${e.total_sessions}  actual=${actual}`)
  })

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('[메이 체크용] 세션 날짜 전체')
  console.log('═══════════════════════════════════════════════════════════')
  for (const p of PLANS) {
    const e = byName[p.name]; if (!e) continue
    const list = (cnt[e.id] || []).slice().sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    console.log(`\n▶ ${p.name} — ${list.length}회 (${p.days.map(d => WD_KR[WD.indexOf(d)]).join('/')}, ${p.timeKr})`)
    if (p.preStart) {
      const preList = list.filter(s => p.preStart! <= s.scheduled_date && s.scheduled_date <= p.preEnd!)
      console.log(`   [pre ${preList.length}회 ${p.preStart}~${p.preEnd}]`)
      console.log('   ' + preList.map(s => {
        const wd = WD_KR[new Date(s.scheduled_date + 'T00:00:00').getDay()]
        return `${s.scheduled_date.slice(5).replace('-', '/')}(${wd})`
      }).join(', '))
    }
    if (p.postStart) {
      const postList = list.filter(s => p.postStart! <= s.scheduled_date && s.scheduled_date <= p.postEnd!)
      console.log(`   [post ${postList.length}회 ${p.postStart}~${p.postEnd}]`)
      console.log('   ' + postList.map(s => {
        const wd = WD_KR[new Date(s.scheduled_date + 'T00:00:00').getDay()]
        return `${s.scheduled_date.slice(5).replace('-', '/')}(${wd})`
      }).join(', '))
    }
  }

  // 전체 세션 수
  const { count: totalNow } = await supabase.from('online_sessions').select('*', { count: 'exact', head: true })
  console.log(`\n═══════════════════════════════════════════════════════════`)
  console.log(`online_sessions 전체: ${totalNow}건`)
  console.log(`(백업 369건 · Phase 5 후 619건 · Phase 6 후 ${totalNow}건)`)
}

run().catch(console.error)
