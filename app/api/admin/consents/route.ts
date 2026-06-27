import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'experience'
  if (type === 'booking') {
    const { data, error } = await supabase.from('booking_consents').select('*').order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const rows = (data || []).map((b: Record<string, unknown>) => ({
      id: b.id, consent_type: 'booking', type_label: '부킹 동의', readonly: true,
      applicant_name: b.booker_name, phone: null, child: null, room: null, month: null,
      reservation_no: b.reservation_no, agreed_items: b.policy_keys, agreed_text: b.agreed_text,
      policy_version: b.policy_version, signature: null, signer_name: null,
      status: 'submitted', submitted_at: b.created_at, created_at: b.created_at,
    }))
    return NextResponse.json({ rows })
  }
  const { data, error } = await supabase.from('consents').select('*').eq('consent_type', type).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const applicant_name = String(body.applicant_name || '').trim()
  if (!applicant_name) return NextResponse.json({ error: '신청자(보호자) 성함을 입력해 주세요.' }, { status: 400 })
  const row = {
    consent_type: String(body.consent_type || 'experience'),
    type_label: String(body.type_label || '체험단 참가 계약 및 동의서'),
    booking_id: body.booking_id || null,
    applicant_name,
    phone: body.phone || null,
    child: body.child || null,
    room: body.room || null,
    month: body.month || null,
  }
  const { data, error } = await supabase.from('consents').insert(row).select('id, public_token').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, public_token: data.public_token })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('consents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
