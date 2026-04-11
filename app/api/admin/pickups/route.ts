import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: pickup_requests + booking info
export async function GET() {
  const [pickups, drivers] = await Promise.all([
    supabase
      .from('pickup_requests')
      .select('*, bookings_new(booker_name, booker_phone, flight_in_airline, num_adults, num_children)')
      .order('request_date', { ascending: true }),
    supabase.from('drivers').select('id, name').eq('is_active', true),
  ])
  if (pickups.error) return NextResponse.json({ error: pickups.error.message }, { status: 500 })
  return NextResponse.json({ pickups: pickups.data, drivers: drivers.data ?? [] })
}

// POST: bookings_new → pickup_requests 자동 추출
export async function POST() {
  // 1. bookings_new에서 flight 정보 있는 예약 조회
  const { data: bookings, error: bErr } = await supabase
    .from('bookings_new')
    .select('id, booker_name, flight_in_date, flight_in_time, flight_out_date, flight_out_time, pickup_place, drop_place, num_adults, num_children')
    .eq('status', 'confirmed')

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })

  // 2. 기존 pickup_requests 조회 (중복 방지)
  const { data: existing } = await supabase
    .from('pickup_requests')
    .select('booking_id, request_type')

  const existSet = new Set((existing ?? []).map(e => `${e.booking_id}_${e.request_type}`))

  const toInsert: Record<string, unknown>[] = []

  for (const b of bookings ?? []) {
    const people = (b.num_adults || 0) + (b.num_children || 0)

    // 픽업 (flight_in)
    if (b.flight_in_date && !existSet.has(`${b.id}_pickup`)) {
      toInsert.push({
        booking_id: b.id,
        request_type: 'pickup',
        request_date: b.flight_in_date,
        request_time: b.flight_in_time || null,
        location: b.pickup_place || '공항',
        destination: '드림하우스',
        num_people: people,
        flight_info: null,
        status: 'pending',
      })
    }

    // 드랍 (flight_out)
    if (b.flight_out_date && !existSet.has(`${b.id}_dropoff`)) {
      toInsert.push({
        booking_id: b.id,
        request_type: 'dropoff',
        request_date: b.flight_out_date,
        request_time: b.flight_out_time || null,
        location: '드림하우스',
        destination: b.drop_place || '공항',
        num_people: people,
        flight_info: null,
        status: 'pending',
      })
    }
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ inserted: 0, message: '새로 추출할 일정 없음' })
  }

  const { error: iErr } = await supabase.from('pickup_requests').insert(toInsert)
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })

  return NextResponse.json({ inserted: toInsert.length })
}

// PATCH: 기사 배정, 상태 변경
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
