import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** 이번 Phase에서 손대지 않을 학생 4명 */
const EXCLUDE = new Set(['심시우', '최서우', '최은우', '전가빈'])

/** 보존 세션 (status != scheduled) — 특수 처리 */
const ATTENDED_KEEP = [
  { student: '이채현', date: '2026-04-17', status: 'attended' },
]
/** 재생성 목록에 없지만 별도로 INSERT해야 할 세션 */
const MAKEUP_INSERT = [
  { student: '이다은', date: '2026-04-17', status: 'makeup' },
]

interface DateRange { start: string; end: string }

function parsePeriods(label: 'pre' | 'post', notes: string | null, baseYear: number): DateRange[] {
  if (!notes) return []
  const prefix = label === 'pre' ? '전' : '후'
  const blocks = [...notes.matchAll(new RegExp(`${prefix}\\(([^)]+)\\)`, 'g'))].map(m => m[1])
  const ranges: DateRange[] = []
  for (const blk of blocks) {
    const segments = blk.split(/[,/]/).map(s => s.trim()).filter(Boolean)
    for (const seg of segments) {
      const rangeM = seg.match(/(\d{1,2})[.](\d{1,2})\s*[-~]\s*(\d{1,2})[.](\d{1,2})/)
      if (rangeM) {
        const sM = +rangeM[1], sD = +rangeM[2], eM = +rangeM[3], eD = +rangeM[4]
        let sY = baseYear, eY = baseYear
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

const DAYIDX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
function normDay(d: string): string {
  const map: Record<string, string> = { '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', '금': 'fri', '토': 'sat', '일': 'sun' }
  return map[d] || d.toLowerCase()
}
function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

async function run() {
  const { data: enrolls } = await supabase
    .from('online_enrollments')
    .select('id, student_name, tutor_id, class_period, pre_sessions, post_sessions, total_sessions, days_of_week, class_time_kr, class_time_ph, start_date, end_date, notes')
    .order('created_at')
  const { data: sess } = await supabase
    .from('online_sessions')
    .select('id, enrollment_id, scheduled_date, status')
    .order('scheduled_date')

  const sesByEnr: Record<string, any[]> = {}
  ;(sess || []).forEach(s => {
    if (!sesByEnr[s.enrollment_id]) sesByEnr[s.enrollment_id] = []
    sesByEnr[s.enrollment_id].push(s)
  })

  const targets = (enrolls || []).filter(e => !EXCLUDE.has(e.student_name))

  console.log('═══════════════════════════════════════════════════════════')
  console.log(`PHASE 4 — DRY-RUN (${targets.length}건, 제외 4건: ${[...EXCLUDE].join(', ')})`)
  console.log('═══════════════════════════════════════════════════════════')

  let totalDelete = 0
  let totalCreate = 0
  const preserveUpdates: any[] = []
  const separateInserts: any[] = []

  for (const e of targets) {
    const yr = +(e.start_date || '').slice(0, 4)
    const preR = parsePeriods('pre', e.notes, yr)
    const postR = parsePeriods('post', e.notes, yr)

    const allPreDates = preR.flatMap(r => expectedDatesIn(r, e.days_of_week || []))
    const allPostDates = postR.flatMap(r => expectedDatesIn(r, e.days_of_week || []))

    // col 개수만큼 앞에서부터 자르기 (정책)
    const preCut = allPreDates.slice(0, e.pre_sessions || 0)
    const postCut = allPostDates.slice(0, e.post_sessions || 0)
    const finalDates = [...preCut, ...postCut]

    const existing = sesByEnr[e.id] || []
    totalDelete += existing.length
    totalCreate += finalDates.length

    const preserve = ATTENDED_KEEP.find(k => k.student === e.student_name)
    const separate = MAKEUP_INSERT.find(k => k.student === e.student_name)
    if (preserve) preserveUpdates.push({ ...preserve, enrollment_id: e.id, tutor_id: e.tutor_id })
    if (separate) separateInserts.push({ ...separate, enrollment_id: e.id, tutor_id: e.tutor_id, time_kr: e.class_time_kr, time_ph: e.class_time_ph })

    console.log(`\n▶ ${e.student_name.padEnd(10)} | period=${e.class_period} | days=${(e.days_of_week || []).join('')} ${e.class_time_kr}`)
    console.log(`   삭제 예정: ${existing.length}개`)
    if (existing.length) {
      const dates = existing.map(s => s.scheduled_date)
      console.log(`     ${dates.slice(0, 4).join(', ')}${dates.length > 4 ? ` … ${dates[dates.length - 1]}` : ''}`)
    }

    console.log(`   생성 예정 PRE: ${preCut.length}개 (col=${e.pre_sessions}, 계산=${allPreDates.length}${allPreDates.length !== preCut.length ? ` — 앞 ${preCut.length}개 truncate` : ''})`)
    if (preCut.length) console.log(`     ${preCut.slice(0, 4).join(', ')}${preCut.length > 4 ? ` … ${preCut[preCut.length - 1]}` : ''}`)

    console.log(`   생성 예정 POST: ${postCut.length}개 (col=${e.post_sessions}, 계산=${allPostDates.length}${allPostDates.length !== postCut.length ? ` — 앞 ${postCut.length}개 truncate` : ''})`)
    if (postCut.length) console.log(`     ${postCut.slice(0, 4).join(', ')}${postCut.length > 4 ? ` … ${postCut[postCut.length - 1]}` : ''}`)

    console.log(`   생성 합계: ${finalDates.length}개 / col total=${e.total_sessions} ${finalDates.length === e.total_sessions ? '✅' : '⚠️'}`)

    if (preserve) {
      const inList = finalDates.includes(preserve.date)
      console.log(`   ⭐ 보존 복원 (UPDATE): ${preserve.date} → status=${preserve.status}  ${inList ? '✅ 재생성에 포함' : '⚠️ 재생성에 없음 — 확인 필요'}`)
    }
    if (separate) {
      const inList = finalDates.includes(separate.date)
      console.log(`   ⭐ 별도 INSERT: ${separate.date} status=${separate.status}  ${inList ? '(⚠️ 이미 재생성 대상에 포함된 날짜 — 중복 주의)' : '✅ 재생성에 없음 → 별도 삽입 필요'}`)
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('전체 요약')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`• 대상 enrollment: ${targets.length}건`)
  console.log(`• 총 삭제 예정 세션: ${totalDelete}개`)
  console.log(`• 총 재생성 예정 세션: ${totalCreate}개`)
  console.log(`• status 복원 (UPDATE): ${preserveUpdates.length}건`)
  preserveUpdates.forEach(p => console.log(`    - ${p.student} ${p.date} → ${p.status}`))
  console.log(`• 별도 INSERT (makeup): ${separateInserts.length}건`)
  separateInserts.forEach(s => console.log(`    - ${s.student} ${s.date} ${s.status}`))
  console.log(`• 제외 4건 (손대지 않음): ${[...EXCLUDE].join(', ')}`)

  // 전체 세션 수 변화 예측
  const { count: origAll } = await supabase.from('online_sessions').select('*', { count: 'exact', head: true })
  const excludedCount = (enrolls || [])
    .filter(e => EXCLUDE.has(e.student_name))
    .reduce((sum, e) => sum + (sesByEnr[e.id]?.length || 0), 0)
  const predictedTotal = (origAll || 0) - totalDelete + totalCreate + separateInserts.length
  console.log(`\n• 실행 전 online_sessions: ${origAll}개`)
  console.log(`• 실행 후 예측: ${predictedTotal}개`)
  console.log(`  (제외 4건 세션 ${excludedCount}개는 그대로 유지)`)
}

run().catch(console.error)
