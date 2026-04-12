import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

async function loadBooking(bookingId: string) {
  // bookings_new 먼저
  const { data: newB } = await supabase.from('bookings_new').select('*').eq('id', bookingId).maybeSingle()
  if (newB) return { booking: newB, source: 'new' as const }
  const { data: oldB } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle()
  if (oldB) return { booking: oldB, source: 'old' as const }
  return null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')
  if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

  const result = await loadBooking(bookingId)
  if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const b = result.booking
  const checkIn = b.check_in || b.checkin_date
  const daysLeft = daysUntil(checkIn)

  return NextResponse.json({
    source: result.source,
    check_in: checkIn,
    days_left: daysLeft,
    locked: daysLeft !== null && daysLeft < 7,
    flight_in: {
      airline: b.flight_in_airline || b.flight_in || '',
      date: b.flight_in_date || '',
      time: b.flight_in_time || '',
    },
    flight_out: {
      airline: b.flight_out_airline || b.flight_out || '',
      date: b.flight_out_date || '',
      time: b.flight_out_time || '',
    },
    booker_name: b.booker_name,
  })
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { booking_id, flight_in, flight_out } = body
    if (!booking_id) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

    const result = await loadBooking(booking_id)
    if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const checkIn = result.booking.check_in || result.booking.checkin_date
    const daysLeft = daysUntil(checkIn)
    if (daysLeft !== null && daysLeft < 7) {
      return NextResponse.json({ error: '체크인 7일 전부터는 수정할 수 없습니다. 관리자에게 문의하세요.' }, { status: 403 })
    }

    const bookerName = result.booking.booker_name || '손님'

    // 업데이트 (bookings_new vs bookings 컬럼 스키마 다름)
    if (result.source === 'new') {
      const { error } = await supabase.from('bookings_new').update({
        flight_in_airline: flight_in?.airline || null,
        flight_in_date: flight_in?.date || null,
        flight_in_time: flight_in?.time || null,
        flight_out_airline: flight_out?.airline || null,
        flight_out_date: flight_out?.date || null,
        flight_out_time: flight_out?.time || null,
      }).eq('id', booking_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const fIn = [flight_in?.airline, flight_in?.date, flight_in?.time].filter(Boolean).join(' ')
      const fOut = [flight_out?.airline, flight_out?.date, flight_out?.time].filter(Boolean).join(' ')
      const { error } = await supabase.from('bookings').update({
        flight_in: fIn || null,
        flight_out: fOut || null,
      }).eq('id', booking_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 어드민 알림 태스크
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('staff_tasks').insert({
      title: `✈️ ${bookerName}님이 항공편을 등록/변경했습니다`,
      assignee: 'all',
      due: today,
      done: false,
      shared: true,
      note: `예약 ID: ${booking_id}\n체크인: ${checkIn || '-'}\n입국: ${flight_in?.airline || ''} ${flight_in?.date || ''} ${flight_in?.time || ''}\n출국: ${flight_out?.airline || ''} ${flight_out?.date || ''} ${flight_out?.time || ''}`,
    })

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
