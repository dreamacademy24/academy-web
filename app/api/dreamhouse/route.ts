import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const firstDay = searchParams.get('firstDay')
  const lastDay = searchParams.get('lastDay')

  const { data, error } = await supabase
    .from('bookings')
    .select('id, accom_room, checkin_date, checkout_date, checkin_time, checkout_time, guest_name, booking_number')
    .not('accom_room', 'is', null)
    .neq('accom_room', '')
    .lte('checkin_date', lastDay)
    .gte('checkout_date', firstDay)
    .order('checkin_date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
