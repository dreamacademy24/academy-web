import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// pickup_requests에 임의의 booking_id가 들어 있을 수 있으므로 별도 fetch 후 in-app join
export async function GET() {
  const [pickupsRes, bookingsRes, driversRes] = await Promise.all([
    supabase.from('pickup_requests').select('*').order('request_date', { ascending: true }),
    supabase.from('bookings').select('id, booker_name, booker_phone, flight_in, flight_out, adults, children, accom_type, reservation_no, house_no, accom_room').limit(2000),
    supabase.from('drivers').select('id, name').eq('is_active', true),
  ])
  if (pickupsRes.error) return NextResponse.json({ error: pickupsRes.error.message }, { status: 500 })

  const bMap = new Map((bookingsRes.data ?? []).map(b => [b.id, b]))
  const pickups = (pickupsRes.data ?? []).map(p => ({
    ...p,
    bookings: bMap.get(p.booking_id) || null,
  }))
  return NextResponse.json({ pickups, drivers: driversRes.data ?? [] })
}

const AIRPORT_PATTERN = /공항|막탄|airport|cebu|MCIA/i
const ACC_KR: Record<string, string> = { jaypark: '제이파크', dreamhouse: '드림하우스', cubenine: '큐브나인' }

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const action = body.action || 'extract'

  if (action === 'extract') {
    const { data: bookings, error: bErr } = await supabase
      .from('bookings')
      .select('id, booker_name, checkin_date, checkout_date, pickup_place, drop_off, adults, children, flight_in, flight_out, status, confirmed, seg1_type, seg1_checkin, seg1_checkout, seg2_type, seg2_checkin, seg2_checkout')

    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })

    const { data: existing } = await supabase
      .from('pickup_requests')
      .select('booking_id, request_type')

    const existSet = new Set((existing ?? []).map(e => `${e.booking_id}_${e.request_type}`))
    const toInsert: Record<string, unknown>[] = []
    let skipped = 0

    for (const b of bookings ?? []) {
      // 취소된 예약 제외
      if (b.status === 'cancelled' || b.status === '취소') { skipped++; continue }
      const people = (Number(b.adults) || 0) + (Number(b.children) || 0)

      // 콤보 예약(숙소 2곳 순서) 여부
      const isCombo = !!(b.seg1_type && b.seg2_type)
      const seg1Name = isCombo ? (ACC_KR[b.seg1_type] || b.seg1_type) : '드림하우스'
      const seg2Name = isCombo ? (ACC_KR[b.seg2_type] || b.seg2_type) : '드림하우스'
      // 도착(픽업) 도착지 = 첫 숙소, 출국(드랍) 출발지 = 마지막 숙소
      const arriveName = seg1Name
      const departName = seg2Name
      const pickupDate = isCombo ? (b.seg1_checkin || b.checkin_date) : b.checkin_date

      // 픽업 추출: checkin_date 있고 pickup_place가 공항/막탄공항 → 공항에서 첫 숙소로
      const isAirportPickup = AIRPORT_PATTERN.test(String(b.pickup_place || ''))
      if (pickupDate && isAirportPickup && !existSet.has(`${b.id}_pickup`)) {
        toInsert.push({
          booking_id: b.id,
          request_type: 'pickup',
          request_date: pickupDate,
          request_time: null,
          location: b.pickup_place || '공항',
          destination: arriveName,
          num_people: people || 1,
          flight_info: b.flight_in || null,
          status: 'pending',
        })
      }

      // 콤보 환승 추출: 첫 숙소 → 둘째 숙소 (환승일 = seg1 체크아웃 = seg2 체크인)
      const transferDate = isCombo ? (b.seg1_checkout || b.seg2_checkin) : null
      if (isCombo && transferDate && !existSet.has(`${b.id}_transfer`)) {
        toInsert.push({
          booking_id: b.id,
          request_type: 'transfer',
          request_date: transferDate,
          request_time: null,
          location: seg1Name,
          destination: seg2Name,
          num_people: people || 1,
          flight_info: null,
          status: 'pending',
        })
      }

      // 드랍 추출: checkout_date 있고 drop_off가 공항/막탄공항 → 마지막 숙소에서 공항으로
      const isAirportDrop = AIRPORT_PATTERN.test(String(b.drop_off || ''))
      if (b.checkout_date && isAirportDrop && !existSet.has(`${b.id}_dropoff`)) {
        toInsert.push({
          booking_id: b.id,
          request_type: 'dropoff',
          request_date: b.checkout_date,
          request_time: null,
          location: departName,
          destination: b.drop_off || '공항',
          num_people: people || 1,
          flight_info: b.flight_out || null,
          status: 'pending',
        })
      }
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ inserted: 0, skipped, message: '새로 추출할 일정 없음 (공항 픽드랍이거나 이미 등록됨)' })
    }

    const { error: iErr } = await supabase.from('pickup_requests').insert(toInsert)
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })
    return NextResponse.json({ inserted: toInsert.length, skipped })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data, error } = await supabase
    .from('pickup_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
