import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const body = await req.json()
  const { booking_number, guest_name } = body

  if (!booking_number || !guest_name) {
    return NextResponse.json({ error: '예약번호와 이름을 입력해주세요.' }, { status: 400 })
  }

  // bookings (기존 테이블) 조회
  const { data: oldBooking } = await supabase
    .from('bookings')
    .select('id, reservation_no, booker_name, booker_english, checkin_date')
    .eq('reservation_no', booking_number.trim())
    .maybeSingle()

  if (oldBooking) {
    const nameMatch =
      oldBooking.booker_name?.toLowerCase() === guest_name.trim().toLowerCase() ||
      oldBooking.booker_english?.toLowerCase() === guest_name.trim().toLowerCase()
    if (nameMatch) {
      return NextResponse.json({
        booking_id: oldBooking.id,
        booking_number: oldBooking.reservation_no,
        guest_name: oldBooking.booker_name,
        check_in_date: oldBooking.checkin_date,
      })
    }
  }

  // bookings_new 테이블 조회
  const { data: newBookings } = await supabase
    .from('bookings_new')
    .select('id, booker_name, booker_phone, check_in')
    .ilike('booker_name', guest_name.trim())

  if (newBookings && newBookings.length > 0) {
    const b = newBookings[0]
    return NextResponse.json({
      booking_id: b.id,
      booking_number: booking_number.trim(),
      guest_name: b.booker_name,
      check_in_date: b.check_in,
    })
  }

  return NextResponse.json({ error: '예약 정보를 찾을 수 없습니다. 예약번호와 이름을 확인해주세요.' }, { status: 404 })
}
