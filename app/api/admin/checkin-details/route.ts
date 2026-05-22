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

// 어드민 저장 시각 스탬프 — admin_saved_at 컬럼이 없어도 저장 자체는 성공 처리
async function stampSavedAt(id: string, fallback: Record<string, unknown>) {
  const { data } = await supabase
    .from('checkin_details')
    .update({ admin_saved_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return data || fallback
}

// GET: bookingId 없으면 bookings 목록 / 있으면 {booking, detail} 반환 (detail 없으면 자동 생성)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  // bookingId(camelCase) 우선, 호환성 위해 booking_id(snake_case)도 허용
  const bookingId = searchParams.get('bookingId') || searchParams.get('booking_id')

  if (!bookingId) {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, booker_name, booker_english, accom_type, accom_room, house_no, checkin_date, checkout_date, pickup_place, drop_off, flight_in, flight_out, adults, children, special_request, students, reservation_no')
      .order('checkin_date', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ bookings: data })
  }

  // booking 기본정보 fetch
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booker_name, booker_english, accom_type, accom_room, house_no, checkin_date, checkout_date, pickup_place, drop_off, flight_in, flight_out, adults, children, special_request, students, reservation_no')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking) return NextResponse.json({ error: 'booking not found' }, { status: 404 })

  // detail 조회
  const { data: existing } = await supabase
    .from('checkin_details')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (existing) return NextResponse.json({ booking, detail: existing })

  // 없으면 자동 생성 (public_token 부여)
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
    extra_pickups: '',
    extra_requests: '',
    public_token: genToken(),
    submitted_at: null,
  }
  const { data: inserted, error: iErr } = await supabase
    .from('checkin_details')
    .insert(newDetail)
    .select()
    .single()
  if (iErr) {
    // INSERT 실패해도 폼은 열 수 있게 newDetail을 반환 (token은 still 클라이언트가 사용 가능)
    return NextResponse.json({ booking, detail: newDetail, error: iErr.message }, { status: 200 })
  }
  return NextResponse.json({ booking, detail: inserted })
}

// POST: upsert 7 필드 (어드민 저장)
export async function POST(req: Request) {
  const body = await req.json()
  const { booking_id, ...fields } = body
  if (!booking_id) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

  const allowed = ['booker_name', 'checkin_date', 'guest_names_en', 'bed_setting', 'usim_request', 'after_trip_request', 'extra_pickups', 'extra_requests']
  const update: Record<string, unknown> = {}
  for (const k of allowed) if (k in fields) update[k] = fields[k]

  const { data: existing } = await supabase.from('checkin_details').select('id, public_token').eq('booking_id', booking_id).maybeSingle()
  if (existing) {
    const { data, error } = await supabase.from('checkin_details').update(update).eq('id', existing.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ detail: await stampSavedAt(existing.id, data) })
  }
  const insertRow = { booking_id, public_token: genToken(), ...update }
  const { data, error } = await supabase.from('checkin_details').insert(insertRow).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ detail: await stampSavedAt(data.id, data) })
}
