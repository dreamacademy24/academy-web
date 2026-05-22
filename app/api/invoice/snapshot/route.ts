import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * invoice_snapshots 테이블 — Supabase SQL Editor에서 1회 실행 필요:
 *
 * CREATE TABLE IF NOT EXISTS invoice_snapshots (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   booking_id text NOT NULL,
 *   saved_data jsonb NOT NULL DEFAULT '{}',
 *   saved_at timestamptz DEFAULT now(),
 *   created_at timestamptz DEFAULT now()
 * );
 * CREATE UNIQUE INDEX IF NOT EXISTS invoice_snapshots_booking_id_key ON invoice_snapshots(booking_id);
 * ALTER TABLE invoice_snapshots ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "all" ON invoice_snapshots FOR ALL USING (true) WITH CHECK (true);
 */

// GET /api/invoice/snapshot?booking_id=xxx — 해당 예약의 최신 스냅샷 1개 조회
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')
  if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('invoice_snapshots')
    .select('*')
    .eq('booking_id', bookingId)
    .order('saved_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ snapshot: data })
}

// POST /api/invoice/snapshot — { booking_id, saved_data } 저장
// booking_id당 항상 최신 1개만 유지 (기존 행 제거 후 삽입)
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || !body.booking_id) {
    return NextResponse.json({ error: 'booking_id required' }, { status: 400 })
  }
  const bookingId = String(body.booking_id)
  const savedData = body.saved_data ?? {}
  const savedAt = new Date().toISOString()

  // 기존 스냅샷 제거 → booking_id당 1개만 유지
  const { error: delErr } = await supabase
    .from('invoice_snapshots')
    .delete()
    .eq('booking_id', bookingId)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  const { data, error } = await supabase
    .from('invoice_snapshots')
    .insert({ booking_id: bookingId, saved_data: savedData, saved_at: savedAt })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, snapshot: data })
}
