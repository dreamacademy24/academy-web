import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [booking, students, pickups, checkin, invoices, accommodations, tutorReqs, shuttleReqs] = await Promise.all([
    supabase.from('bookings_new').select('*').eq('id', id).maybeSingle(),
    supabase.from('students').select('*').eq('booking_id', id).order('name_kr'),
    supabase.from('pickup_requests').select('*').eq('booking_id', id).order('request_date'),
    supabase.from('checkin_details').select('*').eq('booking_id', id).maybeSingle(),
    supabase.from('invoices_new').select('*').eq('booking_id', id).order('created_at'),
    supabase.from('booking_accommodations').select('*').eq('booking_id', id),
    supabase.from('tutor_requests').select('*').eq('booking_id', id).order('created_at', { ascending: false }),
    supabase.from('shuttle_requests').select('*').eq('booking_id', id).order('request_date', { ascending: false }),
  ])

  // 구 bookings 예약: shuttle/pickup은 notes에서 portal_booking_id 검색
  let shuttleExtra: Array<Record<string, unknown>> = []
  let pickupExtra: Array<Record<string, unknown>> = []
  if (!booking.data) {
    // fallback: old bookings
    const { data: oldBooking } = await supabase.from('bookings').select('*').eq('id', id).maybeSingle()
    if (!oldBooking) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const [sh, pk] = await Promise.all([
      supabase.from('shuttle_requests').select('*').ilike('notes', `%portal_booking_id:${id}%`),
      supabase.from('pickup_requests').select('*').ilike('notes', `%portal_booking_id:${id}%`),
    ])
    shuttleExtra = sh.data ?? []
    pickupExtra = pk.data ?? []

    return NextResponse.json({
      booking: oldBooking, source: 'old',
      students: students.data ?? [],
      pickups: [...(pickups.data ?? []), ...pickupExtra],
      checkin: checkin.data, invoices: invoices.data ?? [],
      accommodations: accommodations.data ?? [],
      tutor_requests: tutorReqs.data ?? [],
      shuttle_requests: [...(shuttleReqs.data ?? []), ...shuttleExtra],
    })
  }

  return NextResponse.json({
    booking: booking.data, source: 'new',
    students: students.data ?? [],
    pickups: pickups.data ?? [],
    checkin: checkin.data, invoices: invoices.data ?? [],
    accommodations: accommodations.data ?? [],
    tutor_requests: tutorReqs.data ?? [],
    shuttle_requests: shuttleReqs.data ?? [],
  })
}
