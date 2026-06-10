import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BOOKING_ID = '940f127b-d607-4a6d-b53e-698082e1bb91' // DA-20260609-441032 양지나
const TARGET_END = '2026-07-24'
const TARGET_NAMES = ['오서후', '오지후']

async function run() {
  const { data: b, error: bErr } = await supabase
    .from('bookings')
    .select('id, reservation_no, booker_name, students')
    .eq('id', BOOKING_ID)
    .maybeSingle()
  if (bErr || !b) { console.log('booking 조회 실패:', bErr?.message); return }
  console.log('대상 예약:', b.reservation_no, '/', b.booker_name)

  let arr = []
  try { arr = typeof b.students === 'string' ? JSON.parse(b.students) : (b.students || []) } catch {}
  if (!Array.isArray(arr)) { console.log('students JSONB 배열 아님 — 중단'); return }

  let changed = 0
  const next = arr.map(s => {
    const kor = s.korName || s.name_kr || ''
    const isTarget = TARGET_NAMES.includes(kor)
    const curEnd = s.academyEnd || s.academy_end || ''
    if (isTarget && curEnd !== TARGET_END) {
      changed++
      console.log(`  변경: ${kor} academyEnd ${curEnd} → ${TARGET_END}`)
      return { ...s, academyEnd: TARGET_END, academy_end: TARGET_END }
    }
    return s
  })

  // 안전장치: 정확히 2명만 변경되어야 함 (이미 올바르면 0건 — 그 경우도 허용)
  if (changed > 2) { console.log(`⛔ 변경 대상이 2명 초과(${changed}건) — 중단`); return }
  if (changed === 0) { console.log('이미 2026-07-24로 일치 — JSONB 변경 없음'); }
  else {
    const { error: upErr } = await supabase.from('bookings').update({ students: next }).eq('id', BOOKING_ID)
    if (upErr) { console.log('JSONB 업데이트 실패:', upErr.message); return }
    console.log(`✅ JSONB ${changed}건 업데이트 완료`)
  }

  // students 테이블도 방어적으로 동일 booking_id + 대상 이름만 academy_end 보정 (이미 올바르면 no-op)
  const { data: rows } = await supabase
    .from('students')
    .select('id, name_kr, academy_end')
    .eq('booking_id', BOOKING_ID)
  for (const r of (rows || [])) {
    if (!TARGET_NAMES.includes(r.name_kr)) continue
    if (r.academy_end === TARGET_END) { console.log(`  DB row ${r.name_kr}: 이미 ${TARGET_END} (no-op)`); continue }
    const { error } = await supabase.from('students').update({ academy_end: TARGET_END }).eq('id', r.id)
    console.log(error ? `  DB row ${r.name_kr} 실패: ${error.message}` : `  ✅ DB row ${r.name_kr} academy_end → ${TARGET_END}`)
  }

  // 검증 재조회
  console.log('\n=== 검증 재조회 ===')
  const { data: vb } = await supabase.from('bookings').select('students').eq('id', BOOKING_ID).maybeSingle()
  let varr = []
  try { varr = typeof vb.students === 'string' ? JSON.parse(vb.students) : (vb.students || []) } catch {}
  varr.forEach(s => console.log(`  JSONB ${s.korName||s.name_kr}: academyEnd=${s.academyEnd||s.academy_end}`))
}

run().catch(console.error)
