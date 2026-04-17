import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EXCLUDE = new Set([
  '심시우', '최서우', '최은우', '전가빈',            // 예외처리 (기존)
  '신세하', '신건하', '박도유', '박나은',            // 계산<col 케이스
])

const ATTENDED_KEEP = [
  { student: '이채현', date: '2026-04-17' },
]
const MAKEUP_INSERT = [
  { student: '이다은', date: '2026-04-17' },
]

interface DateRange { start: string; end: string }

function parsePeriods(label: 'pre' | 'post', notes: string | null, baseYear: number): DateRange[] {
  if (!notes) return []
  const prefix = label === 'pre' ? '전' : '후'
  const blocks = [...notes.matchAll(new RegExp(`${prefix}\\(([^)]+)\\)`, 'g'))].map(m => m[1])
  const ranges: DateRange[] = []
  for (const blk of blocks) {
    const segs = blk.split(/[,/]/).map(s => s.trim()).filter(Boolean)
    for (const seg of segs) {
      const r = seg.match(/(\d{1,2})[.](\d{1,2})\s*[-~]\s*(\d{1,2})[.](\d{1,2})/)
      if (r) {
        const sM = +r[1], sD = +r[2], eM = +r[3], eD = +r[4]
        let sY = baseYear, eY = baseYear
        if (eM < sM || (eM === sM && eD < sD)) eY = baseYear + 1
        ranges.push({
          start: `${sY}-${String(sM).padStart(2, '0')}-${String(sD).padStart(2, '0')}`,
          end: `${eY}-${String(eM).padStart(2, '0')}-${String(eD).padStart(2, '0')}`,
        })
        continue
      }
      const s = seg.match(/(\d{1,2})[.](\d{1,2})/)
      if (s) {
        const m = +s[1], d = +s[2]
        const dstr = `${baseYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        ranges.push({ start: dstr, end: dstr })
      }
    }
  }
  return ranges
}

const DAYIDX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
function normDay(d: string): string {
  const map: Record<string, string> = { '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', '금': 'fri', '토': 'sat', '일': 'sun' }
  return map[d] || d.toLowerCase()
}
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function expectedDatesIn(range: DateRange, days: string[]): string[] {
  const out: string[] = []
  const wanted = days.map(normDay)
  const d = new Date(range.start + 'T00:00:00')
  const end = new Date(range.end + 'T00:00:00')
  while (d <= end) {
    const name = Object.keys(DAYIDX).find(k => DAYIDX[k] === d.getDay())!
    if (wanted.includes(name)) out.push(localDateStr(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

const q = (v: string | null | undefined) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`

async function run() {
  const { data: enrolls, error: eErr } = await supabase
    .from('online_enrollments')
    .select('id, student_name, tutor_id, class_period, pre_sessions, post_sessions, total_sessions, days_of_week, class_time_kr, class_time_ph, start_date, end_date, notes')
    .order('created_at')
  if (eErr) { console.log('❌', eErr.message); return }

  const targets = (enrolls || []).filter(e => !EXCLUDE.has(e.student_name))
  const targetIds = targets.map(t => t.id)
  const nameToId: Record<string, any> = {}
  targets.forEach(t => { nameToId[t.student_name] = t })

  console.log(`대상 ${targets.length}건, 제외 ${(enrolls || []).length - targets.length}건`)

  // 재생성 세션 리스트 구성
  const insertRows: string[] = []
  let plannedInsertCount = 0
  for (const e of targets) {
    const yr = +(e.start_date || '').slice(0, 4)
    const preR = parsePeriods('pre', e.notes, yr)
    const postR = parsePeriods('post', e.notes, yr)
    const preAll = preR.flatMap(r => expectedDatesIn(r, e.days_of_week || []))
    const postAll = postR.flatMap(r => expectedDatesIn(r, e.days_of_week || []))
    const preCut = preAll.slice(0, e.pre_sessions || 0)
    const postCut = postAll.slice(0, e.post_sessions || 0)
    const allDates = [...preCut, ...postCut]
    allDates.forEach((date, idx) => {
      insertRows.push(`(${q(e.id)}, ${q(e.tutor_id)}, ${idx + 1}, '${date}', ${q(e.class_time_kr)}, ${q(e.class_time_ph)}, 'scheduled')`)
      plannedInsertCount++
    })
  }

  // 이다은 makeup 별도 INSERT
  const makeupInserts: string[] = []
  for (const m of MAKEUP_INSERT) {
    const e = nameToId[m.student]
    if (!e) continue
    // session_number: 재생성 후 마지막 번호 + 1 (total_sessions + 1)
    const n = (e.total_sessions || 0) + 1
    makeupInserts.push(`(${q(e.id)}, ${q(e.tutor_id)}, ${n}, '${m.date}', ${q(e.class_time_kr)}, ${q(e.class_time_ph)}, 'makeup')`)
  }

  // 이채현 attended UPDATE
  const updateStmts: string[] = []
  for (const a of ATTENDED_KEEP) {
    const e = nameToId[a.student]
    if (!e) continue
    updateStmts.push(`UPDATE online_sessions SET status='attended', recorded_at=now() WHERE enrollment_id=${q(e.id)} AND scheduled_date='${a.date}';`)
  }

  // DO 블록 SQL 조립 (DO $$ ... $$ 는 단일 트랜잭션 — 실패 시 자동 롤백)
  const inClause = targetIds.map(id => q(id)).join(', ')
  const inner: string[] = []
  inner.push(`DELETE FROM online_sessions WHERE enrollment_id IN (${inClause});`)
  if (insertRows.length) {
    const CHUNK = 500
    for (let i = 0; i < insertRows.length; i += CHUNK) {
      const chunk = insertRows.slice(i, i + CHUNK)
      inner.push(`INSERT INTO online_sessions (enrollment_id, tutor_id, session_number, scheduled_date, scheduled_time_kr, scheduled_time_ph, status) VALUES\n${chunk.join(',\n')};`)
    }
  }
  updateStmts.forEach(s => inner.push(s))
  if (makeupInserts.length) {
    inner.push(`INSERT INTO online_sessions (enrollment_id, tutor_id, session_number, scheduled_date, scheduled_time_kr, scheduled_time_ph, status) VALUES\n${makeupInserts.join(',\n')};`)
  }

  const fullSql = `DO $do$\nBEGIN\n${inner.join('\n')}\nEND $do$;`
  console.log('\n[트랜잭션 실행 정보]')
  console.log(`• DELETE 대상 enrollment: ${targetIds.length}건`)
  console.log(`• INSERT 재생성 세션: ${plannedInsertCount}개`)
  console.log(`• UPDATE attended: ${updateStmts.length}건`)
  console.log(`• INSERT makeup: ${makeupInserts.length}건`)
  console.log(`• 총 SQL 길이: ${fullSql.length} chars`)

  console.log('\n🚀 exec_sql 실행 중...')
  const { error: execErr } = await supabase.rpc('exec_sql', { sql: fullSql })
  if (execErr) {
    console.log('❌ 실행 실패 (자동 ROLLBACK):', execErr.message)
    return
  }
  console.log('✅ COMMIT 완료')

  // ═══════════ 검증 ═══════════
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('검증')
  console.log('═══════════════════════════════════════════════════════════')

  // 25건 total vs actual
  const { data: verifyEnr } = await supabase
    .from('online_enrollments')
    .select('id, student_name, total_sessions')
    .in('id', targetIds)
    .order('student_name')

  const { data: allSess } = await supabase
    .from('online_sessions')
    .select('enrollment_id, status')
    .in('enrollment_id', targetIds)

  const cnt: Record<string, number> = {}
  ;(allSess || []).forEach(s => { cnt[s.enrollment_id] = (cnt[s.enrollment_id] || 0) + 1 })

  console.log('\n[1] 25건 total_sessions vs actual')
  let okCount = 0, mismatch: string[] = []
  ;(verifyEnr || []).forEach(e => {
    const actual = cnt[e.id] || 0
    const ok = e.total_sessions === actual
    const tag = ok ? '✅' : '⚠️'
    if (ok) okCount++
    else mismatch.push(`${e.student_name}(total=${e.total_sessions}, actual=${actual})`)
    console.log(`  ${tag} ${e.student_name.padEnd(10)} total=${e.total_sessions}  actual=${actual}`)
  })
  console.log(`  → ${okCount}/${verifyEnr?.length || 0} 일치`)
  if (mismatch.length) console.log(`  ⚠️ 불일치: ${mismatch.join(', ')}`)

  // 이채현 04-17 attended
  console.log('\n[2] 이채현 2026-04-17 status')
  const chId = nameToId['이채현']?.id
  if (chId) {
    const { data: ch } = await supabase
      .from('online_sessions')
      .select('scheduled_date, status')
      .eq('enrollment_id', chId)
      .eq('scheduled_date', '2026-04-17')
    ;(ch || []).forEach(s => console.log(`  • ${s.scheduled_date} status=${s.status} ${s.status === 'attended' ? '✅' : '❌'}`))
  }

  // 이다은 04-17 makeup
  console.log('\n[3] 이다은 2026-04-17 status')
  const ldId = nameToId['이다은']?.id
  if (ldId) {
    const { data: ld } = await supabase
      .from('online_sessions')
      .select('scheduled_date, status')
      .eq('enrollment_id', ldId)
      .eq('scheduled_date', '2026-04-17')
    ;(ld || []).forEach(s => console.log(`  • ${s.scheduled_date} status=${s.status} ${s.status === 'makeup' ? '✅' : '❌'}`))
  }

  // 제외 8건 세션 개수 불변 확인
  console.log('\n[4] 제외 8건 세션 개수 불변 확인')
  const excludedEnr = (enrolls || []).filter(e => EXCLUDE.has(e.student_name))
  const excludedIds = excludedEnr.map(e => e.id)
  const { data: bakRows } = await supabase
    .from('online_sessions_backup_20260417')
    .select('enrollment_id')
    .in('enrollment_id', excludedIds)
  const bakCnt: Record<string, number> = {}
  ;(bakRows || []).forEach(s => { bakCnt[s.enrollment_id] = (bakCnt[s.enrollment_id] || 0) + 1 })
  const { data: curRows } = await supabase
    .from('online_sessions')
    .select('enrollment_id')
    .in('enrollment_id', excludedIds)
  const curCnt: Record<string, number> = {}
  ;(curRows || []).forEach(s => { curCnt[s.enrollment_id] = (curCnt[s.enrollment_id] || 0) + 1 })

  excludedEnr.forEach(e => {
    const b = bakCnt[e.id] || 0
    const c = curCnt[e.id] || 0
    console.log(`  ${b === c ? '✅' : '❌'} ${e.student_name.padEnd(10)} backup=${b}, current=${c}`)
  })

  // 전체 세션 수
  const { count: totalNow } = await supabase.from('online_sessions').select('*', { count: 'exact', head: true })
  console.log(`\n[5] online_sessions 전체: ${totalNow}건 (백업 369 → 현재 ${totalNow})`)
}

run().catch(console.error)
