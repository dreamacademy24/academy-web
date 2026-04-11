import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end) return NextResponse.json({ error: 'start, end required' }, { status: 400 })

  const [pickups, shuttles, drivers] = await Promise.all([
    supabase
      .from('pickup_requests')
      .select('id, booking_id, request_type, request_date, request_time, location, destination, num_people, flight_info, driver_id, status, bookings_new(booker_name)')
      .gte('request_date', start)
      .lte('request_date', end)
      .neq('status', 'cancelled'),
    supabase
      .from('shuttle_requests')
      .select('id, booking_id, request_date, request_time, destination, num_people, round_trip, driver_id, status, bookings_new(booker_name)')
      .gte('request_date', start)
      .lte('request_date', end)
      .neq('status', 'cancelled'),
    supabase.from('drivers').select('id, name').eq('is_active', true).order('name'),
  ])

  if (pickups.error) return NextResponse.json({ error: pickups.error.message }, { status: 500 })
  if (shuttles.error) return NextResponse.json({ error: shuttles.error.message }, { status: 500 })

  type Entry = {
    id: string; date: string; driver_id: string | null; type: string;
    guest: string; time: string; location: string; destination: string;
    num_people: number; flight_info: string; status: string; round_trip?: boolean;
  }

  const entries: Entry[] = []

  for (const p of pickups.data ?? []) {
    entries.push({
      id: p.id,
      date: p.request_date,
      driver_id: p.driver_id,
      type: p.request_type, // pickup | dropoff
      guest: ((p.bookings_new as unknown as { booker_name: string } | null)?.booker_name) || '-',
      time: p.request_time || '',
      location: p.location || '',
      destination: p.destination || '',
      num_people: p.num_people || 0,
      flight_info: p.flight_info || '',
      status: p.status,
    })
  }

  for (const s of shuttles.data ?? []) {
    entries.push({
      id: s.id,
      date: s.request_date,
      driver_id: s.driver_id,
      type: 'shuttle',
      guest: ((s.bookings_new as unknown as { booker_name: string } | null)?.booker_name) || '-',
      time: s.request_time || '',
      location: '',
      destination: s.destination || '',
      num_people: s.num_people || 0,
      flight_info: '',
      status: s.status,
      round_trip: s.round_trip,
    })
  }

  return NextResponse.json({ entries, drivers: drivers.data ?? [] })
}
