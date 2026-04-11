import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const [drivers, vehicles] = await Promise.all([
    supabase.from('drivers').select('*').order('created_at'),
    supabase.from('vehicles').select('*').order('created_at'),
  ])
  if (drivers.error) return NextResponse.json({ error: drivers.error.message }, { status: 500 })
  if (vehicles.error) return NextResponse.json({ error: vehicles.error.message }, { status: 500 })
  return NextResponse.json({ drivers: drivers.data, vehicles: vehicles.data })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { type, ...row } = body // type: 'driver' | 'vehicle'
  const table = type === 'vehicle' ? 'vehicles' : 'drivers'
  const { data, error } = await supabase.from(table).insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { type, id, ...updates } = body
  const table = type === 'vehicle' ? 'vehicles' : 'drivers'
  const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'driver'
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const table = type === 'vehicle' ? 'vehicles' : 'drivers'
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
