import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: token으로 checkin_details + booking 기본정보 반환
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const { data: detail } = await supabase
    .from('checkin_details')
    .select('*')
    .eq('public_token', token)
    .maybeSingle()

  if (!detail) return NextResponse.json({ error: 'invalid token' }, { status: 404 })

  // 예약 기본정보 (있으면 헤더 표시용)
  let booking = null
  if (detail.booking_id) {
    const { data: b } = await supabase
      .from('bookings')
      .select('booker_name, accom_type, checkin_date, checkout_date, reservation_no')
      .eq('id', detail.booking_id)
      .maybeSingle()
    booking = b
  }

  return NextResponse.json({ detail, booking })
}

// POST: 손님 제출 — 6개 답변 저장 + submitted_at = now()
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const body = await req.json()
  const allowed = ['booker_name', 'guest_names_en', 'bed_setting', 'usim_request', 'after_trip_request', 'extra_requests']
  const update: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) update[k] = body[k]
  update.submitted_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('checkin_details')
    .update(update)
    .eq('public_token', token)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'invalid token' }, { status: 404 })
  return NextResponse.json({ ok: true, detail: data })
}
