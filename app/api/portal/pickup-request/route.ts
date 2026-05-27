import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 손님 포털 픽드랍 신청 통합 API
// request_type:
//   'arrival'      — 입국 픽업 (예약당 1건, upsert)
//   'departure'    — 출국 드랍 (예약당 1건, upsert)
//   'extra'        — 추가 픽드랍 (legacy, 매번 insert)
//   'extra_pickup' — 추가 픽업 (매번 insert)
//   'extra_drop'   — 추가 드랍 (매번 insert)
// GET /api/portal/pickup-request?booking_id=...
//   → { requests: [...] } — 해당 예약의 픽드랍 신청 전체 (모든 타입)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_TYPES = ['arrival', 'departure', 'extra', 'extra_pickup', 'extra_drop'] as const
type RequestType = (typeof ALLOWED_TYPES)[number]

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')
  if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('pickup_requests')
    .select('*')
    .eq('booking_id', bookingId)
    .in('request_type', ALLOWED_TYPES as unknown as string[])
    .order('request_date', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data ?? [] })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      booking_id, request_type, request_date, request_time,
      location, destination, num_people, flight_info, notes,
    } = body || {}

    if (!booking_id) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(request_type as RequestType)) {
      return NextResponse.json({ error: 'request_type must be arrival/departure/extra/extra_pickup/extra_drop' }, { status: 400 })
    }
    if (!request_date) return NextResponse.json({ error: 'request_date required' }, { status: 400 })

    const row: Record<string, unknown> = {
      booking_id,
      request_type,
      request_date,
      request_time: request_time || null,
      location: location || null,
      destination: destination || null,
      num_people: num_people || 1,
      flight_info: flight_info || null,
      notes: notes || null,
      status: 'pending',
    }

    // arrival/departure는 예약당 1건만 유지 — 기존 있으면 update, 없으면 insert
    if (request_type === 'arrival' || request_type === 'departure') {
      const { data: existing } = await supabase
        .from('pickup_requests')
        .select('id')
        .eq('booking_id', booking_id)
        .eq('request_type', request_type)
        .maybeSingle()
      if (existing?.id) {
        const { data, error } = await supabase
          .from('pickup_requests')
          .update(row)
          .eq('id', existing.id)
          .select()
          .single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ ok: true, request: data, mode: 'updated' })
      }
    }

    const { data, error } = await supabase
      .from('pickup_requests')
      .insert(row)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, request: data, mode: 'inserted' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
