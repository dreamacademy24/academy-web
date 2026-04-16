import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const enrollmentId = searchParams.get('enrollment_id')
  if (!enrollmentId) return NextResponse.json({ error: 'enrollment_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('online_sessions')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('session_number')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: data ?? [] })
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, status, recorded_by } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const update: Record<string, unknown> = { status }
    if (recorded_by) { update.recorded_by = recorded_by; update.recorded_at = new Date().toISOString(); }

    const { error } = await supabase.from('online_sessions').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
