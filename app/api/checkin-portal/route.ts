import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: booking_id로 기존 데이터 조회
export async function GET(req: NextRequest) {
  const bookingId = req.nextUrl.searchParams.get('bookingId');
  if (!bookingId) return NextResponse.json({ error: '필수값 누락' }, { status: 400 });

  const { data, error } = await supabase
    .from('checkin_details')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ detail: data || {} });
}

// POST: 저장/업데이트
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { bookingId, ...fields } = body;
  if (!bookingId) return NextResponse.json({ error: '필수값 누락' }, { status: 400 });

  const { data: existing } = await supabase
    .from('checkin_details')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle();

  const payload = { ...fields, booking_id: bookingId, submitted_at: new Date().toISOString() };

  let error;
  if (existing?.id) {
    ({ error } = await supabase
      .from('checkin_details')
      .update(payload)
      .eq('id', existing.id));
  } else {
    ({ error } = await supabase
      .from('checkin_details')
      .insert(payload));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
