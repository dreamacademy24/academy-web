import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
실제 컬럼 매핑:
  name_kr       → student_name
  pre_count     → pre_sessions
  post_count    → post_sessions
  days          → days_of_week
  session_date  → scheduled_date
*/

interface DateRange { start: string; end: string } // YYYY-MM-DD

/** notes에서 "전(MM.DD~MM.DD)" 또는 "전(MM.DD)" 등 파싱. year는 baseYear 사용.
 *  여러 segment (slash 구분) 지원 — e.g. "전(03.14 / 05.18~05.28)"
 *  종료일이 시작일보다 앞이면 year+1로 보정.
 */
function parsePeriods(label: 'pre' | 'post', notes: string | null, baseYear: number): DateRange[] {
  if (!notes) return []
  const prefix = label === 'pre' ? '전' : '후'
  // 모든 "전(...)" or "후(...)" 블록 추출
  const blocks = [...notes.matchAll(new RegExp(`${prefix}\\(([^)]+)\\)`, 'g'))].map(m => m[1])
  const ranges: DateRange[] = []
  for (const blk of blocks) {
    const segments = blk.split(/[,/]/).map(s => s.trim()).filter(Boolean)
    for (const seg of segments) {
      // MM.DD ~ MM.DD  or  MM.DD - MM.DD  or  MM.DD 단일
      const rangeM = seg.match(/(\d{1,2})[.](\d{1,2})\s*[-~]\s*(\d{1,2})[.](\d{1,2})/)
      if (rangeM) {
        const sM = +rangeM[1], sD = +rangeM[2], eM = +rangeM[3], eD = +rangeM[4]
        let sY = baseYear, eY = baseYear
        // wrap-around (12월→1월) 처리
        if (eM < sM || (eM === sM && eD < sD)) eY = baseYear + 1
        ranges.push({
          start: `${sY}-${String(sM).padStart(2, '0')}-${String(sD).padStart(2, '0')}`,
          end: `${eY}-${String(eM).padStart(2, '0')}-${String(eD).padStart(2, '0')}`,
        })
        continue
      }
      const singleM = seg.match(/(\d{1,2})[.](\d{1,2})/)
      if (singleM) {
        const m = +singleM[1], d = +singleM[2]
        const dstr = `${baseYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        ranges.push({ start: dstr, end: dstr })
      }
    }
  }
  return ranges
}

function dayIdxToName(idx: number): string {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][idx]
}

/** days_of_week(영문) 기준 주어진 범위 내 예상 수업 날짜 리스트 */
function expectedDatesIn(range: DateRange, days: string[]): string[] {
  const out: string[] = []
  const d = new Date(range.start + 'T00:00:00')
  const end = new Date(range.end + 'T00:00:00')
  while (d <= end) {
    if (days.includes(dayIdxToName(d.getDay()))) {
      out.push(d.toISOString().slice(0, 10))
    }
    d.setDate(d.getDate() + 1)
  }
  return out
}

function inAnyRange(dateStr: string, ranges: DateRange[]): boolean {
  return ranges.some(r => dateStr >= r.start && dateStr <= r.end)
}

async function run() {
  const { data: enrolls, error } = await supabase
    .from('online_enrollments')
    .select('id, student_name, student_name_en, class_period, pre_sessions, post_sessions, total_sessions, used_sessions, days_of_week, class_time_kr, start_date, end_date, notes, created_at')
    .order('created_at')
  if (error) { console.log('❌', error.message); return }

  const { data: sessions, error: sErr } = await supabase
    .from('online_sessions')
    .select('enrollment_id, scheduled_date, status')
  if (sErr) { console.log('❌', sErr.message); return }

  const sesByEnr: Record<string, { date: string; status: string }[]> = {}
  ;(sessions || []).forEach(s => {
    if (!sesByEnr[s.enrollment_id]) sesByEnr[s.enrollment_id] = []
    sesByEnr[s.enrollment_id].push({ date: s.scheduled_date, status: s.status })
  })

  const buckets = {
    ok: [] as string[],
    shortCount: [] as string[],
    wrongPeriod: [] as string[],
    mismatchPeriod: [] as string[],
    noSessions: [] as string[],
    noNotesPeriod: [] as string[],
  }

  console.log(`\n전체 enrollments: ${enrolls?.length || 0}건\n`)
  console.log('─────────────────────────────────────────────────────────────')

  for (const e of (enrolls || [])) {
    const yr = +(e.start_date || '').slice(0, 4) || new Date().getFullYear()
    const preRanges = parsePeriods('pre', e.notes, yr)
    const postRanges = parsePeriods('post', e.notes, yr)
    const sess = sesByEnr[e.id] || []
    const actual = sess.length
    const expectedByCol = (e.pre_sessions || 0) + (e.post_sessions || 0)
    const expectedTotal = e.total_sessions || expectedByCol

    // 세션이 아카데미 기간(start_date~end_date) 안에 있는지
    const inAcademy = sess.filter(s => e.start_date && e.end_date && s.date >= e.start_date && s.date <= e.end_date).length
    const outOfAcademy = actual - inAcademy

    // 세션이 notes(전/후) 기간 안에 있는지
    const allNoteRanges = [...preRanges, ...postRanges]
    const inNotes = sess.filter(s => inAnyRange(s.date, allNoteRanges)).length
    const notInNotes = actual - inNotes

    // pre/post 기대 세션 수 (notes 기간 + days 기준)
    const expPre = preRanges.flatMap(r => expectedDatesIn(r, e.days_of_week || [])).length
    const expPost = postRanges.flatMap(r => expectedDatesIn(r, e.days_of_week || [])).length

    // 세션 분포 (notes 기준)
    const inPre = sess.filter(s => inAnyRange(s.date, preRanges)).length
    const inPost = sess.filter(s => inAnyRange(s.date, postRanges)).length

    // 판정
    let verdict = '✅'
    const issues: string[] = []
    if (actual === 0) {
      verdict = '🔴'
      issues.push('세션 0개')
      buckets.noSessions.push(e.student_name)
    } else {
      if (allNoteRanges.length === 0) {
        issues.push('notes에서 기간 파싱 실패')
        buckets.noNotesPeriod.push(e.student_name)
      }
      if (actual < expectedTotal) {
        issues.push(`세션 부족 ${expectedTotal - actual}개 (actual=${actual}, total=${expectedTotal})`)
        buckets.shortCount.push(`${e.student_name}(-${expectedTotal - actual})`)
      }
      if (allNoteRanges.length && notInNotes > 0 && inAcademy > 0 && outOfAcademy === 0) {
        // 모든 세션이 아카데미 기간 내부에 있고 notes 기간 밖이면 '잘못된 기간'
        issues.push('세션이 아카데미 기간(start~end)에만 있음 — notes 기간 밖')
        buckets.wrongPeriod.push(`${e.student_name}(${e.start_date}~${e.end_date})`)
      }
      // class_period 일관성
      if (e.class_period === 'pre' && inPost > 0) issues.push(`class_period=pre인데 post 기간 세션 ${inPost}개`)
      if (e.class_period === 'post' && inPre > 0) issues.push(`class_period=post인데 pre 기간 세션 ${inPre}개`)
      if (e.class_period === 'pre' && (e.post_sessions || 0) > 0) issues.push(`class_period=pre인데 post_sessions=${e.post_sessions}`)
      if (e.class_period === 'post' && (e.pre_sessions || 0) > 0) issues.push(`class_period=post인데 pre_sessions=${e.pre_sessions}`)

      if (issues.length === 0) {
        verdict = '✅'
        buckets.ok.push(e.student_name)
      } else {
        verdict = '⚠️'
      }
    }

    console.log(
      `${verdict} ${e.student_name.padEnd(12)} | period=${e.class_period} pre/post/total=${e.pre_sessions}/${e.post_sessions}/${e.total_sessions} | days=${(e.days_of_week || []).join('')} ${e.class_time_kr} | actual=${actual} (noteMatch=${inNotes}, academy=${inAcademy}) | expPre=${expPre} expPost=${expPost} actPre=${inPre} actPost=${inPost}`
    )
    if (issues.length) {
      issues.forEach(i => console.log(`     • ${i}`))
    }
    if (allNoteRanges.length) {
      const preStr = preRanges.map(r => `${r.start}~${r.end}`).join(', ') || '-'
      const postStr = postRanges.map(r => `${r.start}~${r.end}`).join(', ') || '-'
      console.log(`     notes→ pre:[${preStr}]  post:[${postStr}]`)
    } else if (e.notes) {
      console.log(`     notes(미파싱)=${e.notes}`)
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('리포트 요약')
  console.log('═══════════════════════════════════════════════════════════')
  const total = enrolls?.length || 0
  console.log(`전체: ${total}건`)
  console.log(`✅ 정상: ${buckets.ok.length}건`)
  if (buckets.ok.length) console.log(`   → ${buckets.ok.join(', ')}`)
  console.log(`🔴 세션 0개: ${buckets.noSessions.length}건`)
  if (buckets.noSessions.length) console.log(`   → ${buckets.noSessions.join(', ')}`)
  console.log(`⚠️ 세션 부족: ${buckets.shortCount.length}건`)
  if (buckets.shortCount.length) console.log(`   → ${buckets.shortCount.join(', ')}`)
  console.log(`⚠️ 잘못된 기간(아카데미 기간에만 세션): ${buckets.wrongPeriod.length}건`)
  if (buckets.wrongPeriod.length) console.log(`   → ${buckets.wrongPeriod.join(', ')}`)
  console.log(`⚠️ notes 기간 파싱 실패: ${buckets.noNotesPeriod.length}건`)
  if (buckets.noNotesPeriod.length) console.log(`   → ${buckets.noNotesPeriod.join(', ')}`)
}

run().catch(console.error)
