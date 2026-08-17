import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')
  if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

  // bookings (live) 먼저 조회
  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { data: students } = await supabase
    .from('students').select('*').eq('booking_id', bookingId).order('name_kr')

  return NextResponse.json({ booking, source: 'old', students: students ?? [] })
}
