import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 유학원 챕터 초기 세팅 — 멱등(IF NOT EXISTS만 사용, 파괴적 변경 없음)
export async function POST(req: Request) {
  const { key } = await req.json().catch(() => ({ key: '' }))
  if (key !== 'dream-agencies-2026') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const ddl = `
CREATE TABLE IF NOT EXISTS agencies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  short_label text,
  contact text,
  commission_rate numeric,
  memo text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all" ON agencies;
CREATE POLICY "all" ON agencies FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON agencies TO anon, authenticated;

CREATE TABLE IF NOT EXISTS agency_payouts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  payout_date date,
  amount numeric,
  memo text,
  booking_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE agency_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all" ON agency_payouts;
CREATE POLICY "all" ON agency_payouts FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON agency_payouts TO anon, authenticated;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS agency_commission_rate numeric;
NOTIFY pgrst, 'reload schema';
`
  const { error } = await supabase.rpc('exec_sql', { sql: ddl })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 시드 3곳 (있으면 무시)
  const seeds = [
    { name: '이젠유학', short_label: '이젠' },
    { name: '영리쉬', short_label: '영' },
    { name: '코코키즈', short_label: '코코' },
  ]
  for (const s of seeds) {
    await supabase.from('agencies').upsert(s, { onConflict: 'name', ignoreDuplicates: true })
  }
  const { data } = await supabase.from('agencies').select('id,name,short_label')
  return NextResponse.json({ ok: true, agencies: data })
}
