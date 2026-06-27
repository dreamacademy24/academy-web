import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const { data, error } = await supabase.from('consent_requests').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const recipient_name = String(body.recipient_name || '').trim()
  if (!recipient_name) return NextResponse.json({ error: '받는 사람 이름을 입력해 주세요.' }, { status: 400 })
  const token = crypto.randomBytes(8).toString('hex')
  const row = {
    public_token: token,
    booking_id: body.booking_id || null,
    recipient_name,
    title: String(body.title || '체험단 참여 동의서'),
    terms_version: String(body.terms_version || '2026-06'),
    created_by: body.created_by || null,
  }
  const { data, error } = await supabase.from('consent_requests').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ row: data })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('consent_requests').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
