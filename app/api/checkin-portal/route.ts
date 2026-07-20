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

  const payload: Record<string, unknown> = { booking_id: bookingId, submitted_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) payload[k] = v === '' ? null : v;

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

  // ✈️ 항공편 필드는 bookings 테이블에도 동기화 (어드민 화면·픽드랍·체크인카드가 bookings를 읽음)
  const flightKeys = [
    'flight_in_airline','flight_in_no','flight_in_date','flight_in_time','flight_in_origin','flight_in_undecided',
    'flight_out_airline','flight_out_no','flight_out_date','flight_out_time','flight_out_destination','flight_out_undecided'
  ];
  const fu: Record<string, unknown> = {};
  for (const k of flightKeys) if (k in fields) {
    const v = (fields as Record<string, unknown>)[k];
    fu[k] = (v === '' || v === undefined) ? null : v;
  }
  if (Object.keys(fu).length > 0) {
    const g = (k: string) => { const v = fu[k]; return v == null ? '' : String(v); };
    if (g('flight_in_airline') || g('flight_in_no') || g('flight_in_date') || g('flight_in_time'))
      fu.flight_in = [g('flight_in_airline'), g('flight_in_no'), g('flight_in_date'), g('flight_in_time')].filter(Boolean).join(' ');
    if (g('flight_out_airline') || g('flight_out_no') || g('flight_out_date') || g('flight_out_time'))
      fu.flight_out = [g('flight_out_airline'), g('flight_out_no'), g('flight_out_date'), g('flight_out_time')].filter(Boolean).join(' ');
    const { error: bErr } = await supabase.from('bookings').update(fu).eq('id', bookingId);
    if (bErr) console.error('[checkin-portal] bookings flight sync failed:', bErr.message);
  }

  return NextResponse.json({ success: true });
}
