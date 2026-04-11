import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const [shuttles, drivers] = await Promise.all([
    supabase
      .from('shuttle_requests')
      .select('*, bookings_new(booker_name, booker_phone, num_adults, num_children)')
      .order('request_date', { ascending: true }),
    supabase.from('drivers').select('id, name').eq('is_active', true),
  ])
  if (shuttles.error) return NextResponse.json({ error: shuttles.error.message }, { status: 500 })
  return NextResponse.json({ shuttles: shuttles.data, drivers: drivers.data ?? [] })
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data, error } = await supabase
    .from('shuttle_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
