import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
  const { data } = await supabase
    .from('consent_requests')
    .select('recipient_name,title,terms_version,agreed,signature_name,submitted_at')
    .eq('public_token', token)
    .maybeSingle()
  if (!data) return NextResponse.json({ error: 'invalid token' }, { status: 404 })
  return NextResponse.json({ consent: data })
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })
  const body = await req.json()
  if (!body.agreed) return NextResponse.json({ error: '약관에 동의해 주세요.' }, { status: 400 })
  const sig = String(body.signature_name || '').trim()
  if (!sig) return NextResponse.json({ error: '서명(성함)을 입력해 주세요.' }, { status: 400 })
  const ua = req.headers.get('user-agent') || ''
  const { data, error } = await supabase
    .from('consent_requests')
    .update({ agreed: true, signature_name: sig, submitted_at: new Date().toISOString(), user_agent: ua })
    .eq('public_token', token)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'invalid token' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
