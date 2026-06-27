import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
  const { data } = await supabase.from('consents').select('*').eq('public_token', token).maybeSingle()
  if (!data) return NextResponse.json({ error: 'invalid token' }, { status: 404 })
  let booking = null
  if (data.booking_id) {
    const { data: b } = await supabase.from('bookings').select('booker_name, accom_type, checkin_date, reservation_no').eq('id', data.booking_id).maybeSingle()
    booking = b
  }
  return NextResponse.json({ consent: data, booking })
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
  const body = await req.json()
  const allowed = ['applicant_name', 'phone', 'email', 'child', 'room', 'month', 'insta', 'blog', 'agreed_items', 'signer_name', 'sig_date', 'signature', 'policy_version']
  const update: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) update[k] = body[k] === '' ? null : body[k]
  if (!update.signature) return NextResponse.json({ error: '서명을 입력해 주세요.' }, { status: 400 })
  update.status = 'submitted'
  update.submitted_at = new Date().toISOString()
  update.user_agent = req.headers.get('user-agent') || ''
  const { data, error } = await supabase.from('consents').update(update).eq('public_token', token).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'invalid token' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
