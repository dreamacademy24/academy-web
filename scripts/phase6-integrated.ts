import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ═══════════ STEP A: 휴강일 테이블 + 데이터 ═══════════
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS online_class_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  holiday_name TEXT,
  holiday_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`

const HOLIDAYS: Array<[string, string, string]> = [
  // 2025 DEC (최서우/최은우용)
  ['2025-12-24', '크리스마스 이브', 'academy'],
  ['2025-12-25', '크리스마스', 'academy'],
  ['2025-12-26', '크리스마스 연휴', 'academy_extra'],
  ['2025-12-27', '드림아카데미 추가', 'academy_extra'],
  // 2026 JAN
  ['2026-01-01', '신정', 'academy'],
  ['2026-01-02', '신정 연휴', 'academy'],
  // 2026 FEB
  ['2026-02-15', '설날 연휴', 'academy'],
  ['2026-02-16', '설날', 'academy'],
  ['2026-02-17', '설날 연휴', 'academy'],
  ['2026-02-18', '설날 추가', 'academy_extra'],
  // 2026 MAR
  ['2026-03-20', '드림아카데미 추가 휴무', 'academy_extra'],
  // 2026 APR
  ['2026-04-02', '아카데미 휴무', 'academy'],
  ['2026-04-03', '아카데미 휴무', 'academy'],
  ['2026-04-04', '드림센터 추가', 'center_extra'],
  // 2026 MAY
  ['2026-05-01', '근로자의 날', 'academy'],
  ['2026-05-05', '어린이날', 'academy'],
  ['2026-05-29', '아카데미 추가', 'academy_extra'],
  // 2026 JUN
  ['2026-06-03', '아카데미 휴무', 'academy'],
  ['2026-06-06', '현충일', 'academy'],
  ['2026-06-12', '아카데미 추가', 'academy_extra'],
  // 2026 AUG
  ['2026-08-09', '드림센터 추가 (아이언맨 행사)', 'center_extra'],
  ['2026-08-15', '광복절', 'academy'],
  // 2026 OCT
  ['2026-10-09', '한글날', 'academy'],
  ['2026-10-30', '드림센터 추가', 'center_extra'],
  ['2026-10-31', '드림센터 추가', 'center_extra'],
  // 2026 NOV
  ['2026-11-27', '아카데미 추가', 'academy_extra'],
  // 2026 DEC
  ['2026-12-20', '아카데미 휴무', 'academy'],
  ['2026-12-24', '크리스마스 이브', 'academy'],
  ['2026-12-25', '크리스마스', 'academy'],
  ['2026-12-26', '크리스마스 연휴', 'academy'],
  ['2026-12-27', '드림아카데미 추가', 'academy_extra'],
  ['2026-12-28', '드림아카데미 추가', 'academy_extra'],
  ['2026-12-29', '드림아카데미 추가', 'academy_extra'],
  ['2026-12-30', '드림아카데미 추가', 'academy_extra'],
  ['2026-12-31', '드림아카데미 추가', 'academy_extra'],
]

const q = (s: string | null) => s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`

// ═══════════ STEP C: 6명 데이터 ═══════════
interface PlanInput {
  name: string
  classPeriod: 'pre' | 'post' | 'both'
  days: string[]        // 영문
  timeDefault: string   // class_time_kr (대표)
  timeDefaultPh: string
  timeSat?: string      // 토요일 별도 시간
  timeSatPh?: string
  preStart?: string; preEnd?: string
  postStart?: string; postEnd?: string
  expectedTotal: number
  expectedPre: number
  expectedPost: number
  notes: string
}

const PLANS: PlanInput[] = [
  {
    name: '신세하',
    classPeriod: 'both', days: ['mon', 'wed', 'fri'], timeDefault: '21:00', timeDefaultPh: '20:00',
    preStart: '2026-04-13', preEnd: '2026-04-24',
    postStart: '2026-05-12', postEnd: '2026-05-23',
    expectedTotal: 12, expectedPre: 6, expectedPost: 6,
    notes: '전(04.13~04.24) 후(05.12~05.23)',
  },
  {
    name: '신건하',
    classPeriod: 'both', days: ['mon', 'wed', 'fri'], timeDefault: '19:00', timeDefaultPh: '18:00',
    preStart: '2026-04-13', preEnd: '2026-04-24',
    postStart: '2026-05-12', postEnd: '2026-05-23',
    expectedTotal: 12, expectedPre: 6, expectedPost: 6,
    notes: '전(04.13~04.24) 후(05.12~05.23)',
  },
  {
    name: '박도유',
    classPeriod: 'post', days: ['mon', 'tue', 'thu'], timeDefault: '19:30', timeDefaultPh: '18:30',
    postStart: '2026-09-01', postEnd: '2026-09-22',
    expectedTotal: 12, expectedPre: 0, expectedPost: 12,
    notes: '후(09.01~09.22)',
  },
  {
    name: '박나은',
    classPeriod: 'post', days: ['mon', 'tue', 'thu'], timeDefault: '19:00', timeDefaultPh: '18:00',
    postStart: '2026-09-01', postEnd: '2026-09-22',
    expectedTotal: 12, expectedPre: 0, expectedPost: 12,
    notes: '후(09.01~09.22)',
  },
  {
    name: '최서우',
    classPeriod: 'post', days: ['tue', 'thu', 'sat'], timeDefault: '19:30', timeDefaultPh: '18:30',
    timeSat: '11:30', timeSatPh: '10:30',
    postStart: '2025-08-31', postEnd: '2025-12-26',
    expectedTotal: 48, expectedPre: 0, expectedPost: 48,
    notes: '후(08.31~12.26) 화목 19:30 토 11:30',
  },
  {
    name: '최은우',
    classPeriod: 'post', days: ['tue', 'thu', 'sat'], timeDefault: '19:00', timeDefaultPh: '18:00',
    timeSat: '11:00', timeSatPh: '10:00',
    postStart: '2025-08-31', postEnd: '2025-12-26',
    expectedTotal: 48, expectedPre: 0, expectedPost: 48,
    notes: '후(08.31~12.26) 화목 19:00 토 11:00',
  },
]

const WD_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const WD_KR = ['일', '월', '화', '수', '목', '금', '토']
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function enumerate(start: string, end: string, targetDays: string[], holidaySet: Set<string>) {
  const out: Array<{ date: string; wd: string; wdKr: string; holiday: boolean; holidayName?: string }> = []
  const d = new Date(start + 'T00:00:00')
  const ed = new Date(end + 'T00:00:00')
  while (d <= ed) {
    const wd = WD_NAMES[d.getDay()]
    const wdKr = WD_KR[d.getDay()]
    if (targetDays.includes(wd)) {
      const ds = localDateStr(d)
      out.push({ date: ds, wd, wdKr, holiday: holidaySet.has(ds) })
    }
    d.setDate(d.getDate() + 1)
  }
  return out
}

async function run() {
  // ═══════════ STEP A 실행 ═══════════
  console.log('═══════════════════════════════════════════════════════════')
  console.log('STEP A: online_class_holidays 테이블 + INSERT')
  console.log('═══════════════════════════════════════════════════════════')

  // CREATE TABLE
  const { error: createErr } = await supabase.rpc('exec_sql', { sql: CREATE_TABLE_SQL })
  if (createErr) { console.log('❌ CREATE TABLE 실패:', createErr.message); return }
  console.log('✅ online_class_holidays 테이블 준비됨 (IF NOT EXISTS)')

  // INSERT (ON CONFLICT로 중복 방지)
  const valuesSql = HOLIDAYS.map(h => `(${q(h[0])}, ${q(h[1])}, ${q(h[2])})`).join(', ')
  const insertSql = `INSERT INTO online_class_holidays (holiday_date, holiday_name, holiday_type) VALUES ${valuesSql} ON CONFLICT (holiday_date) DO UPDATE SET holiday_name=EXCLUDED.holiday_name, holiday_type=EXCLUDED.holiday_type;`
  const { error: insErr } = await supabase.rpc('exec_sql', { sql: insertSql })
  if (insErr) { console.log('❌ INSERT 실패:', insErr.message); return }
  console.log(`✅ 휴강일 ${HOLIDAYS.length}건 upsert 완료`)

  // PostgREST 스키마 캐시 리로드
  try { await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" }) } catch (_) {}
  await new Promise(r => setTimeout(r, 1500))

  // verify — 여러 번 재시도 (스키마 캐시 반영 대기)
  let holidays: any[] = []
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await supabase
      .from('online_class_holidays')
      .select('holiday_date, holiday_name, holiday_type')
      .order('holiday_date')
    if (r.data && r.data.length > 0) { holidays = r.data; break }
    await new Promise(res => setTimeout(res, 800))
  }
  console.log(`\n현재 online_class_holidays: ${holidays?.length || 0}건`)
  const holidaySet = new Set((holidays || []).map(h => h.holiday_date))
  const holidayMap: Record<string, { name: string; type: string }> = {}
  ;(holidays || []).forEach(h => { holidayMap[h.holiday_date] = { name: h.holiday_name, type: h.holiday_type } })
  console.log(`  2025 DEC: ${(holidays || []).filter(h => h.holiday_date.startsWith('2025')).length}건`)
  console.log(`  2026:     ${(holidays || []).filter(h => h.holiday_date.startsWith('2026')).length}건`)

  // ═══════════ STEP B 안내 ═══════════
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('STEP B: 세션 생성 유틸 업데이트')
  console.log('═══════════════════════════════════════════════════════════')
  console.log('→ DRY-RUN에서 holidays 테이블 조회해서 자동 제외')
  console.log('→ 실제 재생성 스크립트도 동일 로직 사용 예정')

  // ═══════════ STEP C: DRY-RUN ═══════════
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('STEP C: 6명 enrollment DRY-RUN')
  console.log('═══════════════════════════════════════════════════════════')

  const { data: enrolls } = await supabase
    .from('online_enrollments')
    .select('id, student_name, tutor_id, class_period, pre_sessions, post_sessions, total_sessions, days_of_week, class_time_kr, class_time_ph, start_date, end_date, notes')
    .in('student_name', PLANS.map(p => p.name))

  const enrMap: Record<string, any> = {}
  ;(enrolls || []).forEach(e => { enrMap[e.student_name] = e })

  // 기존 세션
  const ids = (enrolls || []).map(e => e.id)
  const { data: curSess } = await supabase
    .from('online_sessions')
    .select('enrollment_id, scheduled_date, status')
    .in('enrollment_id', ids)
  const curByEnr: Record<string, any[]> = {}
  ;(curSess || []).forEach(s => {
    if (!curByEnr[s.enrollment_id]) curByEnr[s.enrollment_id] = []
    curByEnr[s.enrollment_id].push(s)
  })

  let totalDelete = 0
  let totalCreate = 0
  const mismatches: string[] = []

  for (const plan of PLANS) {
    const e = enrMap[plan.name]
    if (!e) { console.log(`\n⚠️ ${plan.name}: enrollment 없음`); continue }

    console.log(`\n▶ ${plan.name} (${plan.classPeriod}) | days=${plan.days.join('')} | 화목 ${plan.timeDefault}${plan.timeSat ? ` | 토 ${plan.timeSat}` : ''}`)

    // PRE 계산
    let preAll: Array<{ date: string; wd: string; wdKr: string; holiday: boolean }> = []
    if (plan.preStart && plan.preEnd) {
      preAll = enumerate(plan.preStart, plan.preEnd, plan.days, holidaySet)
    }
    const preValid = preAll.filter(x => !x.holiday)
    const preExcluded = preAll.filter(x => x.holiday)

    // POST 계산
    let postAll: Array<{ date: string; wd: string; wdKr: string; holiday: boolean }> = []
    if (plan.postStart && plan.postEnd) {
      postAll = enumerate(plan.postStart, plan.postEnd, plan.days, holidaySet)
    }
    const postValid = postAll.filter(x => !x.holiday)
    const postExcluded = postAll.filter(x => x.holiday)

    const existing = curByEnr[e.id] || []
    const firstEx = existing[0]?.scheduled_date || '-'
    const lastEx = existing[existing.length - 1]?.scheduled_date || '-'
    console.log(`   [DELETE] 기존 세션 ${existing.length}개 (${firstEx} ~ ${lastEx})`)

    // PRE 출력
    if (plan.preStart) {
      console.log(`\n   [PRE] ${plan.preStart} ~ ${plan.preEnd} (기대=${plan.expectedPre}, raw=${preAll.length}, 휴강=${preExcluded.length}, 유효=${preValid.length})`)
      if (preExcluded.length) preExcluded.forEach(x => console.log(`     제외: ${x.date}(${x.wdKr}) ${holidayMap[x.date]?.name || ''}`))
      console.log(`     ${preValid.map(v => `${v.date.slice(5)}(${v.wdKr})`).join(' ')}`)
      if (preValid.length !== plan.expectedPre) {
        console.log(`     ⚠️ 기대 ${plan.expectedPre} ≠ 계산 ${preValid.length}`)
      } else {
        console.log(`     ✅`)
      }
    }

    // POST 출력
    if (plan.postStart) {
      console.log(`\n   [POST] ${plan.postStart} ~ ${plan.postEnd} (기대=${plan.expectedPost}, raw=${postAll.length}, 휴강=${postExcluded.length}, 유효=${postValid.length})`)
      if (postExcluded.length) postExcluded.forEach(x => console.log(`     제외: ${x.date}(${x.wdKr}) ${holidayMap[x.date]?.name || ''}`))
      if (postValid.length > 20) {
        // 월별 요약
        const byMonth: Record<string, number> = {}
        postValid.forEach(v => { byMonth[v.date.slice(0, 7)] = (byMonth[v.date.slice(0, 7)] || 0) + 1 })
        console.log(`     월별: ${Object.entries(byMonth).map(([m, n]) => `${m}=${n}`).join(' | ')}`)
        console.log(`     샘플: ${postValid.slice(0, 5).map(v => `${v.date.slice(5)}(${v.wdKr})`).join(' ')} … ${postValid.slice(-3).map(v => `${v.date.slice(5)}(${v.wdKr})`).join(' ')}`)
      } else {
        console.log(`     ${postValid.map(v => `${v.date.slice(5)}(${v.wdKr})`).join(' ')}`)
      }
      if (postValid.length !== plan.expectedPost) {
        console.log(`     ⚠️ 기대 ${plan.expectedPost} ≠ 계산 ${postValid.length}`)
      } else {
        console.log(`     ✅`)
      }
    }

    const totalValid = preValid.length + postValid.length
    console.log(`\n   합계: ${totalValid}개 / expected ${plan.expectedTotal} ${totalValid === plan.expectedTotal ? '✅' : '⚠️'}`)

    if (totalValid !== plan.expectedTotal) {
      mismatches.push(`${plan.name}(${totalValid} vs ${plan.expectedTotal})`)
    }

    totalDelete += existing.length
    totalCreate += totalValid
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('요약')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`• 대상: 6명`)
  console.log(`• 총 삭제 예정: ${totalDelete}개`)
  console.log(`• 총 재생성 예정: ${totalCreate}개`)
  console.log(`• expected 합계: ${PLANS.reduce((s, p) => s + p.expectedTotal, 0)}개`)
  if (mismatches.length) {
    console.log(`\n⚠️ 불일치 ${mismatches.length}건 — 기간 재확인 필요:`)
    mismatches.forEach(m => console.log(`   - ${m}`))
  } else {
    console.log(`\n✅ 전원 expected 일치`)
  }
}

run().catch(console.error)
