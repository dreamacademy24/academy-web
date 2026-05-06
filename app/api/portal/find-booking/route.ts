import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: '필수값 누락' }, { status: 400 });

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, reservation_no, booker_name, check_in, check_out, status, accom_type')
    .eq('portal_user_id', userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ booking: booking || null });
}
