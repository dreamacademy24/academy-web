import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// students 테이블 행이 없을 때 booking.students JSON에서 변환 (옛 데이터 호환)
function parseBookingStudents(raw: unknown): Array<Record<string, unknown>> {
  if (!raw) return []
  let arr: Array<Record<string, unknown>> = []
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw) } catch { return [] }
  } else if (Array.isArray(raw)) {
    arr = raw as Array<Record<string, unknown>>
  } else {
    return []
  }
  return arr
    .filter((s) => s && (s.korName || s.name_kr))
    .map((s) => ({
      booking_id: null,
      name_kr: (s.korName ?? s.name_kr ?? '') as string,
      name_en: (s.engName ?? s.name_en ?? null) as string | null,
      age: s.age ?? null,
      level: (s.level ?? (s.grade === '킨더' ? 'kinder' : 'junior')) as string,
      photo_allowed: (s.photo_allowed ?? s.photo === 'O') as boolean,
      _source: 'booking_json',
    }))
}

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
      students: (students.data && students.data.length > 0) ? students.data : parseBookingStudents(oldBooking.students),
      pickups: [...(pickups.data ?? []), ...pickupExtra],
      checkin: checkin.data, invoices: invoices.data ?? [],
      accommodations: accommodations.data ?? [],
      tutor_requests: tutorReqs.data ?? [],
      shuttle_requests: [...(shuttleReqs.data ?? []), ...shuttleExtra],
    })
  }

  return NextResponse.json({
    booking: booking.data, source: 'new',
    students: (students.data && students.data.length > 0) ? students.data : parseBookingStudents(booking.data.students),
    pickups: pickups.data ?? [],
    checkin: checkin.data, invoices: invoices.data ?? [],
    accommodations: accommodations.data ?? [],
    tutor_requests: tutorReqs.data ?? [],
    shuttle_requests: shuttleReqs.data ?? [],
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  // bookings_new 우선, 없으면 bookings (live 테이블)
  const newRow = await supabase.from('bookings_new').update(body).eq('id', id).select().maybeSingle()
  if (newRow.data) return NextResponse.json({ booking: newRow.data, source: 'new' })
  // bookings_new에 없거나 row 없음 → bookings 시도
  const oldRow = await supabase.from('bookings').update(body).eq('id', id).select().maybeSingle()
  if (oldRow.error) return NextResponse.json({ error: oldRow.error.message }, { status: 400 })
  if (!oldRow.data) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ booking: oldRow.data, source: 'old' })
}
