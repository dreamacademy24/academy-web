import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const HOLIDAYS_2026: Array<[string, string, string]> = [
  ['2026-01-01', '신정', 'academy'],
  ['2026-01-02', '신정 연휴', 'academy'],
  ['2026-02-15', '설날 연휴', 'academy'],
  ['2026-02-16', '설날', 'academy'],
  ['2026-02-17', '설날 연휴', 'academy'],
  ['2026-02-18', '설날 연휴', 'academy'],
  ['2026-03-20', '드림아카데미 추가', 'academy_extra'],
  ['2026-04-02', '아카데미 휴무', 'academy'],
  ['2026-04-03', '아카데미 휴무', 'academy'],
  ['2026-04-04', '드림센터 추가', 'center_extra'],
  ['2026-05-01', '근로자의 날', 'academy'],
  ['2026-05-05', '어린이날', 'academy'],
  ['2026-05-29', '아카데미 추가', 'academy_extra'],
  ['2026-06-03', '아카데미 휴무', 'academy'],
  ['2026-06-06', '현충일', 'academy'],
  ['2026-06-12', '아카데미 추가', 'academy_extra'],
  ['2026-08-09', '드림센터 추가 (아이언맨)', 'center_extra'],
  ['2026-08-15', '광복절', 'academy'],
  ['2026-10-30', '드림센터 추가', 'center_extra'],
  ['2026-10-31', '드림센터 추가', 'center_extra'],
  ['2026-11-27', '아카데미 추가', 'academy_extra'],
  ['2026-12-20', '드림아카데미 추가', 'academy_extra'],
  ['2026-12-24', '크리스마스 이브', 'academy'],
  ['2026-12-25', '크리스마스', 'academy'],
  ['2026-12-26', '드림아카데미 추가', 'academy_extra'],
  ['2026-12-27', '드림아카데미 추가', 'academy_extra'],
  ['2026-12-28', '드림아카데미 추가', 'academy_extra'],
  ['2026-12-29', '드림아카데미 추가', 'academy_extra'],
  ['2026-12-30', '드림아카데미 추가', 'academy_extra'],
  ['2026-12-31', '드림아카데미 추가', 'academy_extra'],
]

interface Plan {
  name: string; timeKr: string; timePh: string; timeSat: string; timeSatPh: string
}
const PLANS: Plan[] = [
  { name: '최서우', timeKr: '19:30', timePh: '18:30', timeSat: '11:30', timeSatPh: '10:30' },
  { name: '최은우', timeKr: '19:00', timePh: '18:00', timeSat: '11:00', timeSatPh: '10:00' },
]
const POST_START = '2026-08-31'
const POST_END = '2026-12-26'
const DAYS = ['tue', 'thu', 'sat']
const TOTAL_EXPECTED = 48

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
  // ═══════════ STEP 1: 2026 휴강 재구축 ═══════════
  console.log('═══════════════════════════════════════════════════════════')
  console.log('[STEP 1] 2026 휴강 재구축')
  console.log('═══════════════════════════════════════════════════════════')
  const rebuildSql = `
    DO $h$ BEGIN
      DELETE FROM online_class_holidays WHERE holiday_date >= '2026-01-01' AND holiday_date < '2027-01-01';
      INSERT INTO online_class_holidays (holiday_date, holiday_name, holiday_type) VALUES
      ${HOLIDAYS_2026.map(h => `(${q(h[0])}, ${q(h[1])}, ${q(h[2])})`).join(',\n      ')};
    END $h$;
  `
  const { error: hErr } = await supabase.rpc('exec_sql', { sql: rebuildSql })
  if (hErr) { console.log('❌ 휴강 재구축 실패:', hErr.message); return }
  console.log(`✅ 2026 휴강 ${HOLIDAYS_2026.length}건 재구축 완료`)

  // 휴강 로드 (schema cache reload)
  try { await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" }) } catch (_) {}
  await new Promise(r => setTimeout(r, 1500))
  const { data: hols } = await supabase.from('online_class_holidays').select('holiday_date, holiday_name')
  const holidaySet = new Set((hols || []).map(h => h.holiday_date))
  const holidayName: Record<string, string> = {}
  ;(hols || []).forEach(h => { holidayName[h.holiday_date] = h.holiday_name })
  console.log(`DB 휴강 총: ${holidaySet.size}건 (2025: ${(hols || []).filter(h => h.holiday_date.startsWith('2025')).length} / 2026: ${(hols || []).filter(h => h.holiday_date.startsWith('2026')).length})`)

  // ═══════════ STEP 2: 최서우/최은우 계산 + 안전장치 ═══════════
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('[STEP 2] 세션 계산')
  console.log('═══════════════════════════════════════════════════════════')
  const plannedDates = enumerate(POST_START, POST_END, DAYS, holidaySet)
  console.log(`범위: ${POST_START} ~ ${POST_END}, 요일 화/목/토`)

  // 제외된 휴강 확인
  const excluded: string[] = []
  {
    const d = new Date(POST_START + 'T00:00:00')
    const ed = new Date(POST_END + 'T00:00:00')
    while (d <= ed) {
      const wd = WD[d.getDay()]
      if (DAYS.includes(wd)) {
        const ds = localDateStr(d)
        if (holidaySet.has(ds)) excluded.push(ds)
      }
      d.setDate(d.getDate() + 1)
    }
  }
  console.log(`휴강 제외 (화/목/토): ${excluded.length}개`)
  excluded.forEach(d => console.log(`  - ${d}(${WD_KR[new Date(d + 'T00:00:00').getDay()]}) ${holidayName[d] || ''}`))
  console.log(`최종 세션 수: ${plannedDates.length}개 (기대 ${TOTAL_EXPECTED})`)

  if (plannedDates.length !== TOTAL_EXPECTED) {
    console.log(`\n❌ 계산 ≠ 기대. 실행 중단.`)
    const byMonth: Record<string, number> = {}
    plannedDates.forEach(v => { byMonth[v.date.slice(0, 7)] = (byMonth[v.date.slice(0, 7)] || 0) + 1 })
    console.log(`월별: ${Object.entries(byMonth).map(([m, n]) => `${m}=${n}`).join(' | ')}`)
    return
  }
  console.log(`✅ 48개 일치 — 실행 진행`)

  // ═══════════ STEP 3: 트랜잭션 실행 ═══════════
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('[STEP 3] 트랜잭션 실행 (DELETE + UPDATE + INSERT)')
  console.log('═══════════════════════════════════════════════════════════')

  const { data: enrolls } = await supabase
    .from('online_enrollments')
    .select('id, student_name, tutor_id')
    .in('student_name', PLANS.map(p => p.name))
  const byName: Record<string, any> = {}
  ;(enrolls || []).forEach(e => { byName[e.student_name] = e })
  const targetIds = PLANS.map(p => byName[p.name]?.id).filter(Boolean)

  const inner: string[] = []
  inner.push(`DELETE FROM online_sessions WHERE enrollment_id IN (${targetIds.map(q).join(', ')});`)

  for (const p of PLANS) {
    const e = byName[p.name]; if (!e) continue
    const notes = `후(08.31~12.26) 화목 ${p.timeKr} 토 ${p.timeSat} 휴강(10.31, 12.24, 12.26)`
    const daysArr = `ARRAY[${DAYS.map(q).join(',')}]::text[]`
    inner.push(`UPDATE online_enrollments SET
      class_period='post',
      days_of_week=${daysArr},
      class_time_kr=${q(p.timeKr)},
      class_time_ph=${q(p.timePh)},
      start_date='${POST_START}',
      end_date='${POST_END}',
      pre_sessions=0,
      post_sessions=${TOTAL_EXPECTED},
      total_sessions=${TOTAL_EXPECTED},
      used_sessions=0,
      notes=${q(notes)}
      WHERE id=${q(e.id)};`)

    const rows = plannedDates.map((s, idx) => {
      const isSat = s.wd === 'sat'
      const tkr = isSat ? p.timeSat : p.timeKr
      const tph = isSat ? p.timeSatPh : p.timePh
      return `(${q(e.id)}, ${q(e.tutor_id)}, ${idx + 1}, '${s.date}', ${q(tkr)}, ${q(tph)}, 'scheduled')`
    })
    const CHUNK = 200
    for (let i = 0; i < rows.length; i += CHUNK) {
      inner.push(`INSERT INTO online_sessions (enrollment_id, tutor_id, session_number, scheduled_date, scheduled_time_kr, scheduled_time_ph, status) VALUES\n${rows.slice(i, i + CHUNK).join(',\n')};`)
    }
  }

  const fullSql = `DO $do$\nBEGIN\n${inner.join('\n')}\nEND $do$;`
  console.log(`SQL 길이: ${fullSql.length} chars`)

  const { error: execErr } = await supabase.rpc('exec_sql', { sql: fullSql })
  if (execErr) { console.log('❌ 실행 실패 (자동 롤백):', execErr.message); return }
  console.log('✅ COMMIT 완료')

  // ═══════════ STEP 4: 검증 ═══════════
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('[STEP 4] 검증')
  console.log('═══════════════════════════════════════════════════════════')

  const { data: verify } = await supabase
    .from('online_enrollments')
    .select('id, student_name, total_sessions')
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
    console.log(`  ${actual === e.total_sessions ? '✅' : '⚠️'} ${e.student_name} total=${e.total_sessions} actual=${actual}`)
  })

  console.log('\n[2] 휴강일 없음 확인')
  for (const p of PLANS) {
    const e = byName[p.name]
    const list = cnt[e.id] || []
    console.log(`  ${p.name}:`)
    for (const d of ['2026-10-31', '2026-12-24', '2026-12-26', '2026-12-25']) {
      const f = list.some(s => s.scheduled_date === d)
      console.log(`    ${d}(${WD_KR[new Date(d + 'T00:00:00').getDay()]}): ${f ? '⚠️ 있음' : '✅ 없음'}`)
    }
  }

  // 메이 체크용
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('[메이 체크용] 세션 날짜 (월별 정돈)')
  console.log('═══════════════════════════════════════════════════════════')
  for (const p of PLANS) {
    const e = byName[p.name]
    const list = (cnt[e.id] || []).slice().sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    console.log(`\n▶ ${p.name} — ${list.length}회 (화/목/토, ${p.timeKr} [화목], ${p.timeSat} [토])`)
    const byMonth: Record<string, string[]> = {}
    list.forEach(s => {
      const ym = s.scheduled_date.slice(0, 7)
      const wd = WD_KR[new Date(s.scheduled_date + 'T00:00:00').getDay()]
      const t = s.scheduled_time_kr
      if (!byMonth[ym]) byMonth[ym] = []
      byMonth[ym].push(`${s.scheduled_date.slice(5).replace('-', '/')}(${wd}) ${t}`)
    })
    Object.entries(byMonth).forEach(([m, arr]) => {
      console.log(`   ${m} (${arr.length}회):`)
      console.log(`     ${arr.join(', ')}`)
    })
  }

  const { count: totalNow } = await supabase.from('online_sessions').select('*', { count: 'exact', head: true })
  console.log(`\n═══════════════════════════════════════════════════════════`)
  console.log(`online_sessions 전체: ${totalNow}건`)
  console.log(`(백업 369 · Phase 5 619 · Phase 6-4명 643 · Phase 6-최종 ${totalNow})`)
}

run().catch(console.error)
