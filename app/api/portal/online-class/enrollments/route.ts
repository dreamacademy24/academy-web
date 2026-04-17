import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const customerUserId = searchParams.get('customer_user_id')
  const testUser = searchParams.get('test_user')

  let enrollments: any[] | null = null

  if (customerUserId) {
    const { data, error } = await supabase
      .from('online_enrollments')
      .select('*, tutor:online_tutors(id, name_display, name_en)')
      .eq('customer_user_id', customerUserId)
      .order('start_date', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    enrollments = data ?? []
  } else if (testUser === 'true') {
    const { data, error } = await supabase
      .from('online_enrollments')
      .select('*, tutor:online_tutors(id, name_display, name_en)')
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    enrollments = data ?? []
  } else {
    return NextResponse.json({ error: 'customer_user_id required' }, { status: 400 })
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ enrollments: [], sessions: [] })
  }

  const ids = enrollments.map(e => e.id)
  const { data: sessions, error: sesErr } = await supabase
    .from('online_sessions')
    .select('*')
    .in('enrollment_id', ids)
    .order('session_number')

  if (sesErr) return NextResponse.json({ error: sesErr.message }, { status: 500 })

  return NextResponse.json({ enrollments, sessions: sessions ?? [] })
}
