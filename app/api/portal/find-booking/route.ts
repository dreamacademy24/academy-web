import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: '필수값 누락' }, { status: 400 });

  // 1. portal_user_id 직접 매칭 (이미 링크된 계정)
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, reservation_no, booker_name, status, accom_type')
    .eq('portal_user_id', userId)
    .maybeSingle();

  if (booking) return NextResponse.json({ booking });

  // 2. 이메일에서 예약번호 마지막 4자리 추출 → 자동 매칭
  const { data: authData } = await supabase.auth.admin.getUserById(userId);
  const email = authData?.user?.email || '';
  const portalId = email.split('@')[0].toLowerCase(); // e.g. "ash0370"
  const last4 = portalId.slice(-4); // "0370"

  if (last4 && /^\d{4}$/.test(last4)) {
    const { data: bookingByRes } = await supabase
      .from('bookings')
      .select('id, reservation_no, booker_name, status, accom_type')
      .ilike('reservation_no', `%${last4}`)
      .maybeSingle();

    if (bookingByRes) {
      // portal_user_id 자동 링크 (다음 로그인부터 1번 경로로 바로 찾음)
      await supabase
        .from('bookings')
        .update({ portal_user_id: userId })
        .eq('id', bookingByRes.id);

      return NextResponse.json({ booking: bookingByRes });
    }
  }

  return NextResponse.json({ booking: null });
}
