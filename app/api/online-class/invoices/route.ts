import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const enrollmentId = searchParams.get('enrollment_id')
  let q = supabase.from('online_invoices').select('*').order('issued_at', { ascending: false })
  if (enrollmentId) q = q.eq('enrollment_id', enrollmentId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoices: data ?? [] })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { enrollment_id, invoice_html, created_by } = body
    if (!enrollment_id) return NextResponse.json({ error: 'enrollment_id required' }, { status: 400 })

    const { data, error } = await supabase
      .from('online_invoices')
      .insert({
        enrollment_id,
        invoice_html: invoice_html || null,
        created_by: created_by || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: data.id, invoice: data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
