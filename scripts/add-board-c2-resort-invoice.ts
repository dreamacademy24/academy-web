import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BOARD_ID = 'may'
const NEW_TITLE =
  "리조트용 인보이스 분리 — 일반 예약 건엔 '리조트용 생성' 버튼 빼기(손님용만 노출), '리조트용 생성'은 리조트 예약 건에만 표시, 리조트용 인보이스 양식 새로 제작"

async function main() {
  // 1) 읽기
  const { data: row, error: readErr } = await supabase
    .from('web_board')
    .select('data')
    .eq('id', BOARD_ID)
    .maybeSingle()
  if (readErr) { console.error('READ ERROR:', readErr.message); process.exit(1) }
  if (!row?.data?.chapters || !Array.isArray(row.data.chapters)) {
    console.error('구조 이상: data.chapters 배열을 찾을 수 없음'); process.exit(1)
  }

  const board = row.data
  const c2 = board.chapters.find((c: any) => c.id === 'c2')
  if (!c2) { console.error('c2 챕터 없음'); process.exit(1) }
  if (!Array.isArray(c2.items)) { console.error('c2.items 배열 아님'); process.exit(1) }

  // 2) 중복 방지 가드 (이미 동일 title 있으면 추가 안 함)
  if (c2.items.some((it: any) => it.title === NEW_TITLE)) {
    console.log('이미 동일 항목이 존재합니다. 추가하지 않고 종료.')
    process.exit(0)
  }

  // 3) 새 id 계산 (c2-N 최대값 +1)
  const maxN = c2.items.reduce((m: number, it: any) => {
    const mm = /^c2-(\d+)$/.exec(it.id || '')
    return mm ? Math.max(m, parseInt(mm[1], 10)) : m
  }, 0)
  const newItem = { id: `c2-${maxN + 1}`, done: false, memo: '', title: NEW_TITLE }

  const before = c2.items.length
  c2.items.push(newItem)

  // 4) 쓰기 (전체 board 그대로 upsert — 다른 챕터/항목 불변)
  const { error: writeErr } = await supabase
    .from('web_board')
    .upsert({ id: BOARD_ID, data: board, updated_at: new Date().toISOString() })
  if (writeErr) { console.error('WRITE ERROR:', writeErr.message); process.exit(1) }

  console.log(`✅ 추가 완료: ${newItem.id}`)
  console.log(`c2 항목 수: ${before} → ${c2.items.length}`)

  // 5) 검증 (재조회)
  const { data: verify, error: vErr } = await supabase
    .from('web_board')
    .select('data')
    .eq('id', BOARD_ID)
    .maybeSingle()
  if (vErr) { console.error('VERIFY READ ERROR:', vErr.message); process.exit(1) }
  const vc2 = verify?.data?.chapters?.find((c: any) => c.id === 'c2')
  const totalChapters = verify?.data?.chapters?.length
  const found = vc2?.items?.find((it: any) => it.id === newItem.id)
  console.log('--- 검증 ---')
  console.log('전체 챕터 수:', totalChapters)
  console.log('c2 항목 수:', vc2?.items?.length)
  console.log('추가 항목 존재:', !!found, found ? JSON.stringify(found, null, 2) : '')
  console.log('c2 항목 id 목록:', vc2?.items?.map((it: any) => it.id).join(', '))
}

main()
