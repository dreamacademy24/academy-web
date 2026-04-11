import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: booking_id로 체크인디테일 조회. 없으면 bookings_new에서 자동 생성
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')

  // booking_id 없으면 확정예약 목록 반환
  if (!bookingId) {
    const { data, error } = await supabase
      .from('bookings_new')
      .select('id, booker_name, check_in, check_out, booking_type, pickup_place, drop_place, flight_in_airline, flight_in_date, flight_in_time, flight_out_airline, flight_out_date, flight_out_time, num_adults, num_children, special_request')
      .eq('status', 'confirmed')
      .order('check_in', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ bookings: data })
  }

  // 기존 checkin_details 조회
  const { data: existing } = await supabase
    .from('checkin_details')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (existing) return NextResponse.json({ detail: existing })

  // 없으면 booking 정보로 기본값 생성
  const { data: booking } = await supabase
    .from('bookings_new')
    .select('id, booker_name, check_in, check_out, pickup_place, drop_place, flight_in_airline, flight_in_date, flight_in_time, flight_out_airline, flight_out_date, flight_out_time, num_adults, num_children, special_request')
    .eq('id', bookingId)
    .single()

  if (!booking) return NextResponse.json({ error: 'booking not found' }, { status: 404 })

  // students 조회
  const { data: students } = await supabase
    .from('students')
    .select('name_kr, name_en')
    .eq('booking_id', bookingId)

  const allGuests = [
    booking.booker_name,
    ...(students ?? []).map(s => s.name_kr || s.name_en),
  ].filter(Boolean).join(', ')

  const detail = {
    booking_id: bookingId,
    bed_setting: { master_2f: 0, small_2f: 0, floor_1f: 0 },
    usim: { sim: 0, load: 0 },
    all_guests: allGuests,
    additional_pickups: [],
    shuttles: [],
    extra_arrivals: [],
    etc_notes: booking.special_request || '',
  }

  const { data: inserted, error } = await supabase
    .from('checkin_details')
    .insert(detail)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ detail: inserted, auto_generated: true })
}

// POST: upsert checkin_details
export async function POST(req: Request) {
  const body = await req.json()
  const { booking_id, ...fields } = body
  if (!booking_id) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

  // check if exists
  const { data: existing } = await supabase
    .from('checkin_details')
    .select('id')
    .eq('booking_id', booking_id)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('checkin_details')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } else {
    const { data, error } = await supabase
      .from('checkin_details')
      .insert({ booking_id, ...fields })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }
}
