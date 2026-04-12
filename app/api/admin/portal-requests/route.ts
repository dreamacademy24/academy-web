import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function resolveBooker(notes: string | null, booking_id: string | null): Promise<{ name: string; reservation_no: string | null }> {
  if (booking_id) {
    const { data } = await supabase.from('bookings_new').select('booker_name').eq('id', booking_id).maybeSingle()
    if (data) return { name: data.booker_name, reservation_no: null }
  }
  // notes에서 portal_booking_id 추출
  const m = notes?.match(/portal_booking_id:([a-f0-9-]+)/i)
  if (m) {
    const { data } = await supabase.from('bookings').select('booker_name, reservation_no').eq('id', m[1]).maybeSingle()
    if (data) return { name: data.booker_name, reservation_no: data.reservation_no }
  }
  return { name: '-', reservation_no: null }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'shuttle'

  if (type === 'shuttle') {
    const { data, error } = await supabase
      .from('shuttle_requests')
      .select('*')
      .order('status', { ascending: true }) // pending first alphabetically... so we need custom sort
      .order('request_date', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enrich with booker name
    const enriched = await Promise.all((data ?? []).map(async (r) => {
      const { name, reservation_no } = await resolveBooker(r.notes, r.booking_id)
      return { ...r, booker_name: name, reservation_no }
    }))
    // Sort: pending first
    enriched.sort((a, b) => {
      const order: Record<string, number> = { pending: 0, confirmed: 1, cancelled: 2 }
      return (order[a.status] ?? 3) - (order[b.status] ?? 3)
    })
    return NextResponse.json({ requests: enriched })
  }

  if (type === 'pickup') {
    const { data, error } = await supabase
      .from('pickup_requests')
      .select('*, bookings_new(booker_name)')
      .order('request_date', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ requests: data ?? [] })
  }

  if (type === 'tutor') {
    const { data, error } = await supabase
      .from('tutor_requests')
      .select('*, students(name_kr, booking_id)')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ requests: data ?? [] })
  }

  return NextResponse.json({ error: 'invalid type' }, { status: 400 })
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { type, id, status } = body
    if (!type || !id || !status) return NextResponse.json({ error: 'type, id, status required' }, { status: 400 })

    const table = type === 'shuttle' ? 'shuttle_requests' : type === 'pickup' ? 'pickup_requests' : 'tutor_requests'

    const { data: updated, error } = await supabase.from(table).update({ status }).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 승인 시 driver_schedules에 자동 등록 (셔틀/픽업만)
    if (status === 'confirmed' && (type === 'shuttle' || type === 'pickup')) {
      const row: Record<string, unknown> = {
        driver_id: updated.driver_id || null,
        schedule_date: updated.request_date,
        schedule_type: type === 'shuttle' ? 'shuttle' : (updated.request_type || 'pickup'),
        ref_id: updated.id,
        start_time: updated.request_time || null,
        location: updated.location || null,
        destination: updated.destination || null,
        num_people: updated.num_people || 0,
        notes: updated.notes || null,
      }
      await supabase.from('driver_schedules').insert(row)
    }

    return NextResponse.json({ ok: true, updated })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
