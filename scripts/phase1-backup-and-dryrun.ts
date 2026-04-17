import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BACKUP_TABLE = 'online_sessions_backup_20260417'
const SPECIAL_CASES = ['심시우', '이다은', '이채현']

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
function expectedDatesIn(range: DateRange, days: string[]): string[] {
  const out: string[] = []
  const wanted = days.map(normDay)
  const d = new Date(range.start + 'T00:00:00')
  const end = new Date(range.end + 'T00:00:00')
  while (d <= end) {
    const name = Object.keys(DAYIDX).find(k => DAYIDX[k] === d.getDay())!
    if (wanted.includes(name)) {
      const yy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      out.push(`${yy}-${mm}-${dd}`)
    }
    d.setDate(d.getDate() + 1)
  }
  return out
}

async function execSql(sql: string) {
  const { error } = await supabase.rpc('exec_sql', { sql })
  if (error) throw error
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('PHASE 1 — 안전장치')
  console.log('═══════════════════════════════════════════════════════════')

  // 원본 row count
  const { count: origCount, error: cErr } = await supabase
    .from('online_sessions')
    .select('*', { count: 'exact', head: true })
  if (cErr) { console.log('❌ 원본 count error:', cErr.message); return }
  console.log(`1-1. 원본 online_sessions: ${origCount}건`)

  // 백업 테이블 존재 체크
  const { error: existErr } = await supabase.from(BACKUP_TABLE).select('id', { count: 'exact', head: true })
  if (!existErr) {
    console.log(`⚠️  ${BACKUP_TABLE} 이미 존재 — DROP 후 재생성`)
    await execSql(`DROP TABLE IF EXISTS ${BACKUP_TABLE};`)
  }

  console.log(`1-2. CREATE TABLE ${BACKUP_TABLE} AS SELECT * FROM online_sessions …`)
  try {
    await execSql(`CREATE TABLE ${BACKUP_TABLE} AS SELECT * FROM online_sessions;`)
  } catch (e: any) {
    console.log('❌ 백업 실패:', e.message || e)
    return
  }

  // PostgREST로 count 시도 (스키마 캐시 미등록이면 null)
  const { count: bakCount } = await supabase
    .from(BACKUP_TABLE)
    .select('*', { count: 'exact', head: true })
  // exec_sql로 직접 COUNT 재확인
  let bakSqlCount: number | null = null
  try {
    const { data } = await supabase.rpc('exec_sql', { sql: `SELECT COUNT(*)::int AS c FROM ${BACKUP_TABLE};` })
    bakSqlCount = Array.isArray(data) && data[0] ? data[0].c : (data?.c ?? null)
  } catch (_) {}
  console.log(`     → 백업 테이블 row (REST): ${bakCount ?? 'null(schema cache)'}`)
  console.log(`     → 백업 테이블 row (SQL):  ${bakSqlCount ?? '확인 실패'}`)
  const finalCount = bakCount ?? bakSqlCount
  console.log(`     → ${origCount === finalCount ? '✅ 일치' : `⚠️ 확인 필요 (orig=${origCount}, bak=${finalCount})`}`)

  // 보존 대상 세션
  console.log('\n1-3. 보존 대상 세션 (status != scheduled)')
  const { data: keepSess, error: kErr } = await supabase
    .from('online_sessions')
    .select('id, enrollment_id, scheduled_date, status')
    .neq('status', 'scheduled')
    .order('scheduled_date')
  if (kErr) { console.log('❌', kErr.message); return }
  const keepEnrIds = Array.from(new Set((keepSess || []).map(s => s.enrollment_id)))
  const { data: keepEnrs } = keepEnrIds.length
    ? await supabase.from('online_enrollments').select('id, student_name, class_period').in('id', keepEnrIds)
    : { data: [] as any[] }
  const enrMap: Record<string, any> = {}
  ;(keepEnrs || []).forEach((e: any) => { enrMap[e.id] = e })
  if (!keepSess?.length) {
    console.log('     → 없음')
  } else {
    keepSess.forEach(s => {
      const e = enrMap[s.enrollment_id] || {}
      console.log(`     • ${s.scheduled_date} | ${s.status} | ${e.student_name || '?'} | period=${e.class_period || '?'} | ses.id=${s.id}`)
    })
  }

  // 전체 enrollments + sessions 로드
  const { data: enrolls } = await supabase
    .from('online_enrollments')
    .select('id, student_name, student_name_en, class_period, pre_sessions, post_sessions, total_sessions, days_of_week, class_time_kr, start_date, end_date, notes, created_at')
    .order('created_at')
  const { data: allSess } = await supabase
    .from('online_sessions')
    .select('id, enrollment_id, scheduled_date, status')
    .order('scheduled_date')
  const sesByEnr: Record<string, any[]> = {}
  ;(allSess || []).forEach(s => {
    if (!sesByEnr[s.enrollment_id]) sesByEnr[s.enrollment_id] = []
    sesByEnr[s.enrollment_id].push(s)
  })

  // ══════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('PHASE 2 — 이상 케이스 3건')
  console.log('═══════════════════════════════════════════════════════════')
  for (const name of SPECIAL_CASES) {
    const e = (enrolls || []).find(x => x.student_name === name)
    if (!e) { console.log(`\n▶ ${name}: enrollment 없음`); continue }
    const yr = +(e.start_date || '').slice(0, 4)
    const preR = parsePeriods('pre', e.notes, yr)
    const postR = parsePeriods('post', e.notes, yr)
    const sess = (sesByEnr[e.id] || []).slice().sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    const inPre = sess.filter(s => preR.some(r => s.scheduled_date >= r.start && s.scheduled_date <= r.end))
    const inPost = sess.filter(s => postR.some(r => s.scheduled_date >= r.start && s.scheduled_date <= r.end))
    const inAcademy = sess.filter(s => e.start_date && e.end_date && s.scheduled_date >= e.start_date && s.scheduled_date <= e.end_date)

    console.log(`\n▶ ${name} (id=${e.id})`)
    console.log(`   class_period=${e.class_period} | pre/post/total=${e.pre_sessions}/${e.post_sessions}/${e.total_sessions}`)
    console.log(`   days=${(e.days_of_week || []).join('')} ${e.class_time_kr}`)
    console.log(`   academy=${e.start_date}~${e.end_date}`)
    console.log(`   notes 원본: ${e.notes}`)
    console.log(`   notes 파싱: pre=[${preR.map(r => `${r.start}~${r.end}`).join(', ') || '-'}]`)
    console.log(`              post=[${postR.map(r => `${r.start}~${r.end}`).join(', ') || '-'}]`)
    console.log(`   현재 세션 (${sess.length}개):`)
    sess.forEach(s => {
      const tag = preR.some(r => s.scheduled_date >= r.start && s.scheduled_date <= r.end) ? 'PRE'
        : postR.some(r => s.scheduled_date >= r.start && s.scheduled_date <= r.end) ? 'POST'
        : (s.scheduled_date >= (e.start_date || '') && s.scheduled_date <= (e.end_date || '')) ? 'ACADEMY'
        : 'OUTSIDE'
      const mark = s.status !== 'scheduled' ? '  ⭐보존' : ''
      console.log(`     • ${s.scheduled_date} ${s.status.padEnd(10)} [${tag}]${mark}`)
    })
    console.log(`   분포: PRE=${inPre.length}  POST=${inPost.length}  ACADEMY=${inAcademy.length}  total=${sess.length}`)

    // 재생성 시 기대 날짜
    const expPre = preR.flatMap(r => expectedDatesIn(r, e.days_of_week || []))
    const expPost = postR.flatMap(r => expectedDatesIn(r, e.days_of_week || []))
    console.log(`   재생성 기대 PRE (${expPre.length}개 vs col=${e.pre_sessions}): ${expPre.join(', ') || '-'}`)
    console.log(`   재생성 기대 POST (${expPost.length}개 vs col=${e.post_sessions}): ${expPost.join(', ') || '-'}`)

    // 특수 판단
    if (name === '심시우') {
      const preMention = /전/.test(e.notes || '')
      console.log(`   💡 판단: class_period=${e.class_period}, pre_sessions=${e.pre_sessions}, notes에 "전" 문자열 ${preMention ? '있음' : '없음'}`)
      console.log(`           → 아카데미 기간(${e.start_date}~${e.end_date})에 12개 세션 있음. 원본 데이터가 잘못됐을 가능성 ↑`)
      console.log(`           → 자동수정 대기 (사용자 확인 필요)`)
    }
    if (name === '이다은') {
      const matched = sess.filter(s => preR.some(r => s.scheduled_date >= r.start && s.scheduled_date <= r.end) || postR.some(r => s.scheduled_date >= r.start && s.scheduled_date <= r.end))
      console.log(`   💡 notes 기간 내 세션: ${matched.length}개`)
      matched.forEach(m => console.log(`        • ${m.scheduled_date} (${m.status})`))
      const expAll = [...expPre, ...expPost]
      matched.forEach(m => console.log(`        재생성 매핑: ${m.scheduled_date} ${expAll.includes(m.scheduled_date) ? '✅ 동일 날짜 생성됨' : '❌ 재생성에 없음'}`))
    }
    if (name === '이채현') {
      const attended = sess.filter(s => s.status === 'attended')
      console.log(`   💡 attended 세션: ${attended.length}개`)
      attended.forEach(a => {
        const inExpPost = expPost.includes(a.scheduled_date)
        console.log(`        • ${a.scheduled_date} | 재생성 POST에 ${inExpPost ? '✅ 포함' : '❌ 없음 (날짜 불일치)'}`)
      })
      console.log(`   💡 post 1st/2nd segment별 기대 수:`)
      postR.forEach((r, i) => {
        const seg = expectedDatesIn(r, e.days_of_week || [])
        console.log(`        seg${i + 1} ${r.start}~${r.end}: ${seg.length}개 (${seg.slice(0, 3).join(', ')}${seg.length > 3 ? '…' : ''})`)
      })
    }
  }

  // ══════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('PHASE 3 — DRY-RUN (30건 정상 그룹)')
  console.log('═══════════════════════════════════════════════════════════')
  const normal = (enrolls || []).filter(e => !SPECIAL_CASES.includes(e.student_name))
  let totalToDelete = 0
  let totalToCreate = 0
  const mismatches: string[] = []

  for (const e of normal) {
    const yr = +(e.start_date || '').slice(0, 4)
    const preR = parsePeriods('pre', e.notes, yr)
    const postR = parsePeriods('post', e.notes, yr)
    const sess = sesByEnr[e.id] || []
    const expPre = preR.flatMap(r => expectedDatesIn(r, e.days_of_week || []))
    const expPost = postR.flatMap(r => expectedDatesIn(r, e.days_of_week || []))
    const expTotal = expPre.length + expPost.length
    const matchPre = expPre.length === (e.pre_sessions || 0)
    const matchPost = expPost.length === (e.post_sessions || 0)
    const matchTotal = expTotal === (e.total_sessions || 0)
    const mark = matchPre && matchPost && matchTotal ? '✅' : '⚠️'
    if (!(matchPre && matchPost && matchTotal)) {
      mismatches.push(`${e.student_name}(pre:${expPre.length}/${e.pre_sessions},post:${expPost.length}/${e.post_sessions},total:${expTotal}/${e.total_sessions})`)
    }

    totalToDelete += sess.length
    totalToCreate += expTotal

    const preDateRange = sess.length ? `${sess[0].scheduled_date} ~ ${sess[sess.length - 1].scheduled_date}` : '-'
    console.log(`\n${mark} ${e.student_name.padEnd(10)} | period=${e.class_period} | days=${(e.days_of_week || []).join('')} ${e.class_time_kr}`)
    console.log(`   삭제 예정: ${sess.length}개 (${preDateRange})`)
    console.log(`   생성 예정 PRE: ${expPre.length}개 (col=${e.pre_sessions}) ${matchPre ? '✅' : '⚠️'}  ${expPre.slice(0, 4).join(', ')}${expPre.length > 4 ? ` … ${expPre[expPre.length - 1]}` : ''}`)
    console.log(`   생성 예정 POST: ${expPost.length}개 (col=${e.post_sessions}) ${matchPost ? '✅' : '⚠️'}  ${expPost.slice(0, 4).join(', ')}${expPost.length > 4 ? ` … ${expPost[expPost.length - 1]}` : ''}`)
    console.log(`   생성 합계: ${expTotal}개 (col=${e.total_sessions}) ${matchTotal ? '✅' : '⚠️'}`)
  }

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('요약')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`• 백업 테이블: ${BACKUP_TABLE} (${bakCount}건)`)
  console.log(`• 보존 세션: ${keepSess?.length || 0}건`)
  console.log(`• 특수 3건: ${SPECIAL_CASES.join(', ')} (개별 확인 필요)`)
  console.log(`• 정상 그룹 30건:`)
  console.log(`    - 삭제 예정 세션 총합: ${totalToDelete}개`)
  console.log(`    - 생성 예정 세션 총합: ${totalToCreate}개`)
  console.log(`    - ⚠️ col 불일치 건수: ${mismatches.length}건`)
  if (mismatches.length) {
    mismatches.forEach(m => console.log(`      • ${m}`))
  }
}

run().catch(console.error)
