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
 *   confirmed_at timestamptz,
 *   created_at timestamptz DEFAULT now()
 * );
 * CREATE UNIQUE INDEX IF NOT EXISTS invoice_snapshots_booking_id_key ON invoice_snapshots(booking_id);
 * ALTER TABLE invoice_snapshots ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
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

  // booking_id 기준 upsert — 항상 최신 1개만 유지 (delete+insert 경쟁 구간 제거)
  const { data, error } = await supabase
    .from('invoice_snapshots')
    .upsert({ booking_id: bookingId, saved_data: savedData, saved_at: savedAt }, { onConflict: 'booking_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, snapshot: data })
}

// DELETE /api/invoice/snapshot?booking_id=xxx — 저장된 인보이스 전체 삭제 (초기화)
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')
  if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })
  const { error } = await supabase.from('invoice_snapshots').delete().eq('booking_id', bookingId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/invoice/snapshot — { booking_id, confirmed_at?, saved_data? } 확정/해제 + 데이터 저장
// confirmed_at:
//   · null            → 확정 해제
//   · ISO 문자열       → 해당 시각으로 확정
//   · 키 자체 누락     → 서버 now()로 확정
//   · 'keep' (문자열) → 기존 confirmed_at 유지 (변경 안 함)
// saved_data 가 같이 들어오면 saved_data + saved_at 도 함께 갱신
// upsert 사용 → 행이 없어도 자동 생성. 컬럼 미존재(마이그레이션 미실행) 시 명확한 에러 반환.
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || !body.booking_id) {
    return NextResponse.json({ error: 'booking_id required' }, { status: 400 })
  }
  const bookingId = String(body.booking_id)
  const hasConfirmedKey = Object.prototype.hasOwnProperty.call(body, 'confirmed_at')
  const keepConfirmed = body.confirmed_at === 'keep'

  const update: Record<string, unknown> = { booking_id: bookingId }
  if (!keepConfirmed) {
    update.confirmed_at = hasConfirmedKey
      ? (body.confirmed_at === null ? null : (body.confirmed_at || new Date().toISOString()))
      : new Date().toISOString()
  }
  if (body.saved_data !== undefined) {
    update.saved_data = body.saved_data
    update.saved_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('invoice_snapshots')
    .upsert(update, { onConflict: 'booking_id' })
    .select()
    .single()

  if (error) {
    // confirmed_at 컬럼 미존재 시 마이그레이션 실행 안내
    const msg = error.message || ''
    const hint = /confirmed_at/.test(msg)
      ? ' — Supabase SQL Editor에서 ALTER TABLE invoice_snapshots ADD COLUMN IF NOT EXISTS confirmed_at timestamptz; 실행 필요'
      : ''
    return NextResponse.json({ error: msg + hint }, { status: 500 })
  }
  return NextResponse.json({ ok: true, snapshot: data })
}
