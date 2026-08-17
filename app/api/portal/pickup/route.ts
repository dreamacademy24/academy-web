import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getBookingInfo(bookingId: string) {
  const { data: oldB } = await supabase.from('bookings').select('id, booker_name, reservation_no').eq('id', bookingId).maybeSingle()
  if (oldB) return { source: 'old' as const, booker_name: oldB.booker_name, reservation_no: oldB.reservation_no, in_new: false }
  return null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')
  if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

  const info = await getBookingInfo(bookingId)
  if (!info) return NextResponse.json({ error: 'booking not found' }, { status: 404 })

  let requests: Array<Record<string, unknown>> = []
  if (info.in_new) {
    // 손님 신청은 request_type='additional'로 저장
    const { data } = await supabase.from('pickup_requests').select('*')
      .eq('booking_id', bookingId).eq('request_type', 'additional')
      .order('request_date', { ascending: false })
    requests = data ?? []
  } else {
    const { data } = await supabase.from('pickup_requests').select('*')
      .eq('request_type', 'additional')
      .ilike('notes', `%portal_booking_id:${bookingId}%`)
      .order('request_date', { ascending: false })
    requests = data ?? []
  }
  return NextResponse.json({ requests })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { booking_id, request_date, request_time, location, destination, num_people, flight_info } = body
    if (!booking_id || !request_date || !location || !destination) {
      return NextResponse.json({ error: 'booking_id, request_date, location, destination required' }, { status: 400 })
    }

    const info = await getBookingInfo(booking_id)
    if (!info) return NextResponse.json({ error: 'booking not found' }, { status: 404 })

    const row: Record<string, unknown> = {
      request_type: 'additional',
      request_date,
      request_time: request_time || null,
      location, destination,
      num_people: num_people || 1,
      flight_info: flight_info || null,
      status: 'pending',
      notes: info.in_new ? null : `portal_booking_id:${booking_id}`,
    }
    if (info.in_new) row.booking_id = booking_id

    const { data, error } = await supabase.from('pickup_requests').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('staff_tasks').insert({
      title: `🛬 ${info.booker_name}님이 추가 픽업을 신청했습니다`,
      assignee: 'all', due: today, done: false, shared: true,
      note: `예약: ${info.booker_name} (${(info as { reservation_no?: string }).reservation_no || booking_id})\n날짜: ${request_date} ${request_time || ''}\n출발: ${location}\n도착: ${destination}\n인원: ${num_people || 1}명`,
    })
    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data: existing } = await supabase.from('pickup_requests').select('status').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (existing.status !== 'pending') return NextResponse.json({ error: '이미 처리된 신청은 취소할 수 없습니다.' }, { status: 403 })
  const { error } = await supabase.from('pickup_requests').update({ status: 'cancelled' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
