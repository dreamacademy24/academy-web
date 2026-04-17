import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface StudentInvoice {
  name: string
  daysTueThu: string // e.g. "19:30"
  daysTueThuPh: string // PH time (-1h)
  daysSat: string   // e.g. "11:30"
  daysSatPh: string
  start: string
  end: string
  holidays: string[] // YYYY-MM-DD
  totalSessions: number
}

const INVOICES: StudentInvoice[] = [
  {
    name: '최서우',
    daysTueThu: '19:30', daysTueThuPh: '18:30',
    daysSat: '11:30', daysSatPh: '10:30',
    start: '2025-08-31', end: '2025-12-26',
    holidays: ['2025-12-24', '2025-12-25', '2025-12-26'],
    totalSessions: 48,
  },
  {
    name: '최은우',
    daysTueThu: '19:00', daysTueThuPh: '18:00',
    daysSat: '11:00', daysSatPh: '10:00',
    start: '2025-08-31', end: '2025-12-26',
    holidays: ['2025-12-24', '2025-12-25', '2025-12-26'],
    totalSessions: 48,
  },
]

const WD_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const WD_KR = ['일', '월', '화', '수', '목', '금', '토']
const TARGET_DAYS = new Set(['tue', 'thu', 'sat'])

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function enumerateDates(start: string, end: string, holidays: Set<string>): Array<{ date: string; wd: string; wdKr: string; excluded?: 'holiday' | null }> {
  const out: Array<{ date: string; wd: string; wdKr: string; excluded?: 'holiday' | null }> = []
  const d = new Date(start + 'T00:00:00')
  const ed = new Date(end + 'T00:00:00')
  while (d <= ed) {
    const wd = WD_NAMES[d.getDay()]
    const wdKr = WD_KR[d.getDay()]
    if (TARGET_DAYS.has(wd)) {
      const ds = localDateStr(d)
      const excluded = holidays.has(ds) ? 'holiday' : null
      out.push({ date: ds, wd, wdKr, excluded })
    }
    d.setDate(d.getDate() + 1)
  }
  return out
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('PHASE 6-A: 현재 상태 조회')
  console.log('═══════════════════════════════════════════════════════════')

  const { data: enrolls, error } = await supabase
    .from('online_enrollments')
    .select('id, student_name, student_name_en, tutor_id, class_period, pre_sessions, post_sessions, total_sessions, days_of_week, class_time_kr, class_time_ph, start_date, end_date, notes, created_at')
    .in('student_name', ['최서우', '최은우'])
  if (error) { console.log('❌', error.message); return }

  ;(enrolls || []).forEach(e => {
    console.log(`\n▶ ${e.student_name} (id=${e.id})`)
    console.log(`   class_period=${e.class_period} | pre/post/total=${e.pre_sessions}/${e.post_sessions}/${e.total_sessions}`)
    console.log(`   days=${(e.days_of_week || []).join('')} | class_time_kr=${e.class_time_kr} | class_time_ph=${e.class_time_ph}`)
    console.log(`   start=${e.start_date} end=${e.end_date}`)
    console.log(`   notes: ${e.notes || '-'}`)
  })

  // 현재 세션 수
  const ids = (enrolls || []).map(e => e.id)
  const { data: cur } = await supabase
    .from('online_sessions')
    .select('enrollment_id, scheduled_date, status')
    .in('enrollment_id', ids)
    .order('scheduled_date')
  const curByEnr: Record<string, any[]> = {}
  ;(cur || []).forEach(s => {
    if (!curByEnr[s.enrollment_id]) curByEnr[s.enrollment_id] = []
    curByEnr[s.enrollment_id].push(s)
  })
  console.log(`\n현재 세션 수:`)
  ;(enrolls || []).forEach(e => {
    const list = curByEnr[e.id] || []
    const first = list[0]?.scheduled_date || '-'
    const last = list[list.length - 1]?.scheduled_date || '-'
    console.log(`   ${e.student_name}: ${list.length}개 (${first} ~ ${last})`)
  })

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('PHASE 6-A: 날짜 계산 검증')
  console.log('═══════════════════════════════════════════════════════════')

  // 모든 인보이스는 같은 기간이므로 한 번만 계산
  const invoice = INVOICES[0]
  const holidaySet = new Set(invoice.holidays)
  const all = enumerateDates(invoice.start, invoice.end, holidaySet)
  const valid = all.filter(x => !x.excluded)
  const excluded = all.filter(x => x.excluded)

  console.log(`\n기간: ${invoice.start} ~ ${invoice.end}`)
  console.log(`요일: 화/목/토 | 휴강: ${invoice.holidays.join(', ')}`)
  console.log(`raw 대상 요일: ${all.length}개`)
  console.log(`→ 휴강 제외: ${excluded.length}개 (${excluded.map(e => `${e.date}(${e.wdKr})`).join(', ')})`)
  console.log(`→ 유효 수업일: ${valid.length}개`)
  console.log(`→ 인보이스 기재: ${invoice.totalSessions}회`)
  console.log(`→ ${valid.length === invoice.totalSessions ? '✅ 일치' : `⚠️ ${valid.length - invoice.totalSessions}개 차이`}`)

  // 월별 카운트
  console.log(`\n월별 유효 수업일:`)
  const byMonth: Record<string, number> = {}
  valid.forEach(v => {
    const ym = v.date.slice(0, 7)
    byMonth[ym] = (byMonth[ym] || 0) + 1
  })
  Object.entries(byMonth).forEach(([ym, n]) => console.log(`   ${ym}: ${n}회`))

  if (valid.length !== invoice.totalSessions) {
    console.log(`\n⚠️ 계산값 ${valid.length} vs 인보이스 ${invoice.totalSessions} — 추가 휴강 가능성`)
    console.log(`   가능한 추가 휴강 후보 (한국 공휴일 중 화/목/토):`)
    // 2025 한국 공휴일 중 화/목/토
    const krHolidays2025 = [
      { date: '2025-10-03', name: '개천절', wdKr: '금' },
      { date: '2025-10-06', name: '추석연휴', wdKr: '월' },
      { date: '2025-10-07', name: '추석', wdKr: '화' },
      { date: '2025-10-08', name: '추석연휴', wdKr: '수' },
      { date: '2025-10-09', name: '한글날', wdKr: '목' },
      { date: '2025-12-25', name: '크리스마스', wdKr: '목' },
    ]
    krHolidays2025.forEach(h => {
      const matched = valid.find(v => v.date === h.date)
      if (matched) console.log(`      • ${h.date} (${h.wdKr}) ${h.name} — 현재 유효일에 포함됨`)
    })
  }

  // 전체 날짜 테이블
  console.log(`\n유효 수업일 전체 (${valid.length}개):`)
  valid.forEach((v, i) => {
    if (i % 8 === 0) process.stdout.write('\n   ')
    process.stdout.write(`${v.date}(${v.wdKr}) `)
  })
  console.log('')

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('PHASE 6-B: DRY-RUN — UPDATE + 세션 재생성 계획')
  console.log('═══════════════════════════════════════════════════════════')

  for (const inv of INVOICES) {
    const e = (enrolls || []).find(x => x.student_name === inv.name)
    if (!e) { console.log(`\n⚠️ ${inv.name} enrollment 없음`); continue }

    console.log(`\n▶ ${inv.name}`)

    // UPDATE 내용 diff
    const updated = {
      class_period: 'post',
      pre_sessions: 0,
      post_sessions: inv.totalSessions,
      total_sessions: inv.totalSessions,
      days_of_week: ['tue', 'thu', 'sat'],
      class_time_kr: inv.daysTueThu, // 주된 시간 (화/목 기준)
      class_time_ph: inv.daysTueThuPh,
      start_date: inv.start,
      end_date: inv.end,
      notes: `후(${inv.start.slice(5).replace('-', '.')}~${inv.end.slice(5).replace('-', '.')}) 화목 ${inv.daysTueThu} 토 ${inv.daysSat} 휴강(12.24~12.26)`
    }
    console.log(`   [UPDATE online_enrollments]`)
    const keys: (keyof typeof updated)[] = ['class_period', 'pre_sessions', 'post_sessions', 'total_sessions', 'days_of_week', 'class_time_kr', 'class_time_ph', 'start_date', 'end_date', 'notes']
    keys.forEach(k => {
      const before = (e as any)[k]
      const after = (updated as any)[k]
      const same = JSON.stringify(before) === JSON.stringify(after)
      console.log(`     ${same ? ' ' : '→'} ${k.padEnd(16)} ${JSON.stringify(before)} ${same ? '' : `  =>  ${JSON.stringify(after)}`}`)
    })

    // 세션 DELETE + INSERT
    const existing = curByEnr[e.id] || []
    console.log(`\n   [DELETE online_sessions]: ${existing.length}개 (기존)`)

    // 재생성 날짜 (시간은 요일별로 분기)
    const sessionsPlan = valid.map((v, i) => ({
      session_number: i + 1,
      date: v.date,
      wd: v.wd,
      time_kr: v.wd === 'sat' ? inv.daysSat : inv.daysTueThu,
      time_ph: v.wd === 'sat' ? inv.daysSatPh : inv.daysTueThuPh,
    }))
    console.log(`   [INSERT online_sessions]: ${sessionsPlan.length}개 재생성`)
    console.log(`     화/목 시간 ${inv.daysTueThu} | 토 시간 ${inv.daysSat}`)
    console.log(`     샘플: ${sessionsPlan.slice(0, 3).map(s => `${s.date}(${WD_KR[WD_NAMES.indexOf(s.wd)]}) ${s.time_kr}`).join(', ')} … ${sessionsPlan[sessionsPlan.length - 1].date}(${WD_KR[WD_NAMES.indexOf(sessionsPlan[sessionsPlan.length - 1].wd)]}) ${sessionsPlan[sessionsPlan.length - 1].time_kr}`)

    // 요일별 분포
    const byWd: Record<string, number> = {}
    sessionsPlan.forEach(s => { byWd[s.wd] = (byWd[s.wd] || 0) + 1 })
    console.log(`     요일 분포: 화=${byWd.tue || 0}, 목=${byWd.thu || 0}, 토=${byWd.sat || 0}`)
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('요약')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`• 대상 enrollment: 2건 (최서우, 최은우)`)
  console.log(`• 총 삭제 예정: ${(enrolls || []).reduce((s, e) => s + (curByEnr[e.id]?.length || 0), 0)}개`)
  console.log(`• 총 생성 예정: ${valid.length * INVOICES.length}개 (계산값 기준)`)
  console.log(`• 인보이스 기재값 합계: ${INVOICES.reduce((s, i) => s + i.totalSessions, 0)}개`)
  if (valid.length !== INVOICES[0].totalSessions) {
    console.log(`\n⚠️ 계산값 ≠ 인보이스값 (${valid.length} vs ${INVOICES[0].totalSessions}). 추가 휴강일 지시 필요.`)
  }
}

run().catch(console.error)
