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
  timeSat?: string
  timeSatPh?: string
  preStart?: string; preEnd?: string
  postStart?: string; postEnd?: string
  preSessions: number; postSessions: number; totalSessions: number
  startDate: string; endDate: string
  notes: string
}

const PLANS: Plan[] = [
  { name: '신세하', classPeriod: 'both', days: ['mon','wed','fri'], timeKr: '21:00', timePh: '20:00',
    preStart: '2026-04-13', preEnd: '2026-04-24', postStart: '2026-05-12', postEnd: '2026-05-25',
    preSessions: 6, postSessions: 6, totalSessions: 12,
    startDate: '2026-04-13', endDate: '2026-05-25', notes: '전(04.13~04.24) 후(05.12~05.25) 월수금 21:00' },
  { name: '신건하', classPeriod: 'both', days: ['mon','wed','fri'], timeKr: '19:00', timePh: '18:00',
    preStart: '2026-04-13', preEnd: '2026-04-24', postStart: '2026-05-12', postEnd: '2026-05-25',
    preSessions: 6, postSessions: 6, totalSessions: 12,
    startDate: '2026-04-13', endDate: '2026-05-25', notes: '전(04.13~04.24) 후(05.12~05.25) 월수금 19:00' },
  { name: '박도유', classPeriod: 'post', days: ['mon','tue','thu'], timeKr: '19:30', timePh: '18:30',
    postStart: '2026-09-01', postEnd: '2026-09-28',
    preSessions: 0, postSessions: 12, totalSessions: 12,
    startDate: '2026-09-01', endDate: '2026-09-28', notes: '후(09.01~09.28) 월화목 19:30' },
  { name: '박나은', classPeriod: 'post', days: ['mon','tue','thu'], timeKr: '19:00', timePh: '18:00',
    postStart: '2026-09-01', postEnd: '2026-09-28',
    preSessions: 0, postSessions: 12, totalSessions: 12,
    startDate: '2026-09-01', endDate: '2026-09-28', notes: '후(09.01~09.28) 월화목 19:00' },
  { name: '최서우', classPeriod: 'post', days: ['tue','thu','sat'], timeKr: '19:30', timePh: '18:30',
    timeSat: '11:30', timeSatPh: '10:30',
    postStart: '2025-08-31', postEnd: '2025-12-26',
    preSessions: 0, postSessions: 48, totalSessions: 48,
    startDate: '2025-08-31', endDate: '2025-12-26', notes: '후(08.31~12.26) 화목 19:30 토 11:30' },
  { name: '최은우', classPeriod: 'post', days: ['tue','thu','sat'], timeKr: '19:00', timePh: '18:00',
    timeSat: '11:00', timeSatPh: '10:00',
    postStart: '2025-08-31', postEnd: '2025-12-26',
    preSessions: 0, postSessions: 48, totalSessions: 48,
    startDate: '2025-08-31', endDate: '2025-12-26', notes: '후(08.31~12.26) 화목 19:00 토 11:00' },
]

const WD = ['sun','mon','tue','wed','thu','fri','sat']
const WD_KR = ['일','월','화','수','목','금','토']
const pad = (n: number) => String(n).padStart(2, '0')
function localDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }

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
    d.setDate(d.getDate()+1)
  }
  return out
}

const q = (v: string | null | undefined) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`

async function run() {
  // ═══════════ 1. 휴강 3건 추가 ═══════════
  console.log('═══════════════════════════════════════════════════════════')
  console.log('[STEP 1] 휴강 3건 INSERT (class_only)')
  console.log('═══════════════════════════════════════════════════════════')
  const newHolidays = [
    ['2025-10-31', '화상영어 휴강', 'class_only'],
    ['2025-12-24', '크리스마스 이브', 'class_only'],
    ['2025-12-26', '크리스마스 연휴', 'class_only'],
  ]
  const valSql = newHolidays.map(h => `(${q(h[0])}, ${q(h[1])}, ${q(h[2])})`).join(', ')
  const { error: hErr } = await supabase.rpc('exec_sql', {
    sql: `INSERT INTO online_class_holidays (holiday_date, holiday_name, holiday_type) VALUES ${valSql} ON CONFLICT (holiday_date) DO NOTHING;`
  })
  if (hErr) { console.log('❌', hErr.message); return }
  console.log('✅ 휴강 upsert 완료')
  try { await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" }) } catch(_) {}
  await new Promise(r => setTimeout(r, 1500))

  // 휴강 로드
  const { data: hols } = await supabase.from('online_class_holidays').select('holiday_date, holiday_name')
  const holidaySet = new Set((hols || []).map(h => h.holiday_date))
  const holidayName: Record<string, string> = {}
  ;(hols || []).forEach(h => { holidayName[h.holiday_date] = h.holiday_name })
  console.log(`현재 online_class_holidays: ${holidaySet.size}건`)

  // ═══════════ 2. 세션 계산 + 안전장치 ═══════════
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('[STEP 2] 세션 계산 + 안전장치')
  console.log('═══════════════════════════════════════════════════════════')
  const planDates: Record<string, Array<{ date: string; wd: string }>> = {}
  let abort = false
  for (const p of PLANS) {
    const list: Array<{ date: string; wd: string }> = []
    if (p.preStart && p.preEnd) list.push(...enumerate(p.preStart, p.preEnd, p.days, holidaySet))
    if (p.postStart && p.postEnd) list.push(...enumerate(p.postStart, p.postEnd, p.days, holidaySet))
    planDates[p.name] = list
    const match = list.length === p.totalSessions
    console.log(`  ${match ? '✅' : '⚠️'} ${p.name.padEnd(6)} 계산=${list.length} 기대=${p.totalSessions}`)
    if (!match) abort = true
  }

  if (abort) {
    console.log('\n❌ 일부 학생 계산 ≠ 기대. 실행 중단 (DB 변경 없음)')
    console.log('\n[최서우/최은우 상세] 2025-08-31 ~ 2025-12-26 화/목/토')
    for (const name of ['최서우', '최은우']) {
      const list = planDates[name]
      console.log(`\n  ${name}: ${list.length}개 (기대 48)`)
      const byMonth: Record<string, number> = {}
      list.forEach(v => { byMonth[v.date.slice(0, 7)] = (byMonth[v.date.slice(0, 7)] || 0) + 1 })
      console.log(`  월별: ${Object.entries(byMonth).map(([m, n]) => `${m}=${n}`).join(' | ')}`)
      // 제외된 휴강
      const excluded = new Set<string>()
      const full = new Date('2025-08-31T00:00:00')
      const endD = new Date('2025-12-26T00:00:00')
      const days = ['tue', 'thu', 'sat']
      while (full <= endD) {
        const wd = WD[full.getDay()]
        if (days.includes(wd)) {
          const ds = localDateStr(full)
          if (holidaySet.has(ds)) excluded.add(ds)
        }
        full.setDate(full.getDate()+1)
      }
      console.log(`  대상 요일 중 휴강 제외: ${excluded.size}개`)
      for (const d of excluded) console.log(`    - ${d}(${WD_KR[new Date(d+'T00:00:00').getDay()]}) ${holidayName[d] || ''}`)
    }
    return
  }

  // ═══════════ 3. 트랜잭션 실행 ═══════════
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('[STEP 3] 6명 DELETE + UPDATE + INSERT (DO 블록 트랜잭션)')
  console.log('═══════════════════════════════════════════════════════════')

  const names = PLANS.map(p => p.name)
  const { data: enrolls } = await supabase
    .from('online_enrollments')
    .select('id, student_name, tutor_id')
    .in('student_name', names)
  const byName: Record<string, any> = {}
  ;(enrolls || []).forEach(e => { byName[e.student_name] = e })
  const targetIds = names.map(n => byName[n]?.id).filter(Boolean)

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

    const rows = planDates[p.name].map((s, idx) => {
      const isSat = s.wd === 'sat'
      const tkr = isSat && p.timeSat ? p.timeSat : p.timeKr
      const tph = isSat && p.timeSatPh ? p.timeSatPh : p.timePh
      return `(${q(e.id)}, ${q(e.tutor_id)}, ${idx + 1}, '${s.date}', ${q(tkr)}, ${q(tph)}, 'scheduled')`
    })
    const CHUNK = 200
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      inner.push(`INSERT INTO online_sessions (enrollment_id, tutor_id, session_number, scheduled_date, scheduled_time_kr, scheduled_time_ph, status) VALUES\n${chunk.join(',\n')};`)
    }
  }

  const fullSql = `DO $do$\nBEGIN\n${inner.join('\n')}\nEND $do$;`
  console.log(`SQL 길이: ${fullSql.length} chars`)
  console.log(`INSERT 총: ${PLANS.reduce((a, p) => a + planDates[p.name].length, 0)}개`)

  const { error: execErr } = await supabase.rpc('exec_sql', { sql: fullSql })
  if (execErr) { console.log('❌ 실행 실패 (자동 롤백):', execErr.message); return }
  console.log('✅ COMMIT 완료')

  // ═══════════ 4. 검증 ═══════════
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('[STEP 4] 검증')
  console.log('═══════════════════════════════════════════════════════════')

  const { data: verify } = await supabase
    .from('online_enrollments')
    .select('id, student_name, class_period, days_of_week, class_time_kr, start_date, end_date, pre_sessions, post_sessions, total_sessions, notes')
    .in('id', targetIds)
    .order('student_name')

  const { data: cur } = await supabase
    .from('online_sessions')
    .select('enrollment_id, scheduled_date, scheduled_time_kr, status')
    .in('enrollment_id', targetIds)
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

  // 최서우/최은우 휴강일 확인
  console.log('\n[2] 최서우/최은우 휴강일 제외 검증 (10-31, 12-24, 12-26은 세션에 없어야 함)')
  for (const nm of ['최서우', '최은우']) {
    const e = (verify || []).find(x => x.student_name === nm); if (!e) continue
    const list = cnt[e.id] || []
    const checkDates = ['2025-10-31', '2025-12-24', '2025-12-26', '2025-12-25']
    console.log(`  ${nm}:`)
    for (const d of checkDates) {
      const found = list.some(s => s.scheduled_date === d)
      console.log(`    ${d}: ${found ? '⚠️ 존재함' : '✅ 없음'}`)
    }
  }

  // 메이 체크용
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('[메이 체크용] 세션 날짜 전체')
  console.log('═══════════════════════════════════════════════════════════')
  for (const p of PLANS) {
    const e = byName[p.name]; if (!e) continue
    const list = (cnt[e.id] || []).slice().sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    const daysStr = p.days.map(d => WD_KR[WD.indexOf(d)]).join('/')
    const timeStr = p.timeSat ? `${p.timeKr} [화목] / ${p.timeSat} [토]` : `${p.timeKr}`
    console.log(`\n▶ ${p.name} — ${list.length}회 (${daysStr}, ${timeStr})`)

    const inPre = p.preStart ? list.filter(s => s.scheduled_date >= p.preStart! && s.scheduled_date <= p.preEnd!) : []
    const inPost = p.postStart ? list.filter(s => s.scheduled_date >= p.postStart! && s.scheduled_date <= p.postEnd!) : []
    if (inPre.length) {
      console.log(`   [pre ${inPre.length}회 ${p.preStart}~${p.preEnd}]`)
      console.log('   ' + inPre.map(s => {
        const wd = WD_KR[new Date(s.scheduled_date+'T00:00:00').getDay()]
        return `${s.scheduled_date.slice(5).replace('-','/')}(${wd})`
      }).join(', '))
    }
    if (inPost.length) {
      console.log(`   [post ${inPost.length}회 ${p.postStart}~${p.postEnd}]`)
      // 최서우/최은우는 월별 그룹화
      if (inPost.length > 20) {
        const byMonth: Record<string, string[]> = {}
        inPost.forEach(s => {
          const ym = s.scheduled_date.slice(0, 7)
          const wd = WD_KR[new Date(s.scheduled_date+'T00:00:00').getDay()]
          if (!byMonth[ym]) byMonth[ym] = []
          byMonth[ym].push(`${s.scheduled_date.slice(5).replace('-','/')}(${wd})`)
        })
        Object.entries(byMonth).forEach(([m, arr]) => console.log(`     ${m}: ${arr.join(', ')}`))
      } else {
        console.log('   ' + inPost.map(s => {
          const wd = WD_KR[new Date(s.scheduled_date+'T00:00:00').getDay()]
          return `${s.scheduled_date.slice(5).replace('-','/')}(${wd})`
        }).join(', '))
      }
    }
  }

  const { count: totalNow } = await supabase.from('online_sessions').select('*', { count: 'exact', head: true })
  console.log(`\n═══════════════════════════════════════════════════════════`)
  console.log(`online_sessions 전체: ${totalNow}건`)
  console.log(`(백업 369 · Phase 5 619 · Phase 6-4명 643 · Phase 6-전원 ${totalNow})`)
}

run().catch(console.error)
