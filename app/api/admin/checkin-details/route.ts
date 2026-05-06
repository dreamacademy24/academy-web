import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function genToken(): string {
  return randomBytes(8).toString('hex') // 16 hex chars
}

// GET: booking_id 없으면 bookings 목록 / 있으면 checkin_details 조회 (없으면 자동 생성)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')

  if (!bookingId) {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, booker_name, booker_english, accom_type, accom_room, house_no, checkin_date, checkout_date, pickup_place, drop_off, flight_in, flight_out, adults, children, special_request, students, reservation_no')
      .order('checkin_date', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ bookings: data })
  }

  const { data: existing } = await supabase
    .from('checkin_details')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (existing) return NextResponse.json({ detail: existing })

  // 없으면 booking 정보로 자동 생성
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booker_name, checkin_date, students')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking) return NextResponse.json({ error: 'booking not found' }, { status: 404 })

  let guestNames = ''
  try {
    const arr = typeof booking.students === 'string' ? JSON.parse(booking.students) : booking.students
    if (Array.isArray(arr)) {
      guestNames = arr.map((s: { engName?: string; name_en?: string }) => s.engName || s.name_en || '').filter(Boolean).join(' / ')
    }
  } catch {}

  const newDetail = {
    booking_id: bookingId,
    booker_name: booking.booker_name || '',
    checkin_date: booking.checkin_date || '',
    guest_names_en: guestNames,
    bed_setting: '',
    usim_request: '',
    after_trip_request: '',
    extra_requests: '',
    public_token: genToken(),
    submitted_at: null,
  }
  const { data: inserted, error: iErr } = await supabase
    .from('checkin_details')
    .insert(newDetail)
    .select()
    .single()
  if (iErr) return NextResponse.json({ error: iErr.message, detail: newDetail }, { status: 200 })
  return NextResponse.json({ detail: inserted })
}

// POST: upsert 7 필드 (어드민 저장)
export async function POST(req: Request) {
  const body = await req.json()
  const { booking_id, ...fields } = body
  if (!booking_id) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

  const allowed = ['booker_name', 'checkin_date', 'guest_names_en', 'bed_setting', 'usim_request', 'after_trip_request', 'extra_requests']
  const update: Record<string, unknown> = {}
  for (const k of allowed) if (k in fields) update[k] = fields[k]

  const { data: existing } = await supabase.from('checkin_details').select('id, public_token').eq('booking_id', booking_id).maybeSingle()
  if (existing) {
    const { data, error } = await supabase.from('checkin_details').update(update).eq('id', existing.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ detail: data })
  }
  const insertRow = { booking_id, public_token: genToken(), ...update }
  const { data, error } = await supabase.from('checkin_details').insert(insertRow).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ detail: data })
}
