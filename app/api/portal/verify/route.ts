import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { booking_number, guest_name } = body

    if (!booking_number || !guest_name) {
      return NextResponse.json({ error: '예약번호와 이름을 입력해주세요.' }, { status: 400 })
    }

    const name = guest_name.trim()
    const bno = booking_number.trim()

    // 1. bookings (기존 테이블) — 예약번호 + 이름 매칭
    const { data: oldBooking, error: oldErr } = await supabase
      .from('bookings')
      .select('id, reservation_no, booker_name, booker_english, checkin_date, status')
      .eq('reservation_no', bno)
      .maybeSingle()

    if (oldErr) console.error('bookings query error:', oldErr.message)

    if (oldBooking) {
      const nameMatch =
        oldBooking.booker_name?.toLowerCase() === name.toLowerCase() ||
        oldBooking.booker_english?.toLowerCase() === name.toLowerCase()
      if (nameMatch) {
        return NextResponse.json({
          booking_id: oldBooking.id,
          booking_number: oldBooking.reservation_no,
          guest_name: oldBooking.booker_name,
          check_in_date: oldBooking.checkin_date,
          status: oldBooking.status,
        })
      }
    }

    // 2. bookings_new — 이름으로 검색 (예약번호 컬럼 없음)
    const { data: newBookings, error: newErr } = await supabase
      .from('bookings_new')
      .select('id, booker_name, check_in, status')
      .ilike('booker_name', name)

    if (newErr) console.error('bookings_new query error:', newErr.message)

    if (newBookings && newBookings.length > 0) {
      const b = newBookings[0]
      return NextResponse.json({
        booking_id: b.id,
        booking_number: bno,
        guest_name: b.booker_name,
        check_in_date: b.check_in,
        status: b.status,
      })
    }

    return NextResponse.json({ error: '예약 정보를 찾을 수 없습니다. 예약번호와 이름을 확인해주세요.' }, { status: 404 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    console.error('portal verify error:', msg)
    return NextResponse.json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 })
  }
}
