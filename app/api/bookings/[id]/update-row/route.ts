import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_TABLES = new Set(['students', 'pickup_requests', 'shuttle_requests'])

// POST: { table: 'pickup_requests', fields: {...} } — 직원이 손님 대신 직접 등록 (채팅 신청 등)
const PK_INSERT_FIELDS = new Set(['request_type', 'request_date', 'request_time', 'location', 'destination', 'num_people', 'notes', 'status', 'ticket_url'])
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params
  const body = await req.json().catch(() => null)
  const { table, fields } = body || {}
  if (table !== 'pickup_requests' || !fields || typeof fields !== 'object') {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  const row: Record<string, unknown> = { booking_id: bookingId, status: 'confirmed' }
  Object.keys(fields).forEach(k => { if (PK_INSERT_FIELDS.has(k)) row[k] = fields[k] })
  if (!row.request_type || !row.request_date) return NextResponse.json({ error: 'request_type, request_date 필수' }, { status: 400 })
  const { data, error } = await supabase.from('pickup_requests').insert(row).select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, row: data })
}

// PATCH: { table: 'students'|'pickup_requests'|'shuttle_requests', rowId: string, fields: {...} }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params
  const body = await req.json()
  const { table, rowId, fields } = body || {}

  if (!table || !ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: 'invalid table' }, { status: 400 })
  }
  if (!rowId || !fields || typeof fields !== 'object') {
    return NextResponse.json({ error: 'rowId and fields required' }, { status: 400 })
  }

  // 보안: 해당 row가 booking_id와 일치하는지 확인 후 update
  const { data: existing } = await supabase.from(table).select('booking_id').eq('id', rowId).maybeSingle()
  if (!existing || existing.booking_id !== bookingId) {
    return NextResponse.json({ error: 'row not found or booking_id mismatch' }, { status: 404 })
  }

  const { data, error } = await supabase.from(table).update(fields).eq('id', rowId).select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ row: data })
}

// PUT: students JSONB (booking-level) 업데이트 — students table row 없는 경우 JSONB만 동기화
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params
  const body = await req.json()
  const { studentsJsonb } = body || {}
  if (!Array.isArray(studentsJsonb)) {
    return NextResponse.json({ error: 'studentsJsonb array required' }, { status: 400 })
  }
  const { error } = await supabase.from('bookings').update({ students: studentsJsonb }).eq('id', bookingId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
