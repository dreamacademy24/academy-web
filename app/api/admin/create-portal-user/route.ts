import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { isCommuteBooking } from '@/lib/bookingTypes';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { bookingId, username, password } = await req.json();
  if (!bookingId || !username || !password) {
    return NextResponse.json({ error: '필수값 누락' }, { status: 400 });
  }

  // 중복 체크
  const { data: existing } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .eq('portal_username', username)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: '이미 사용 중인 아이디입니다' }, { status: 409 });
  }

  // 예약 유형으로 포털 계정 타입 결정 (통학형 → commute, 그 외 → all_in_one)
  // 추후 공지·동의·사진 등 통학형 대상 기능에서 user_metadata.portal_type 으로 구분 가능
  const { data: bkType } = await supabaseAdmin
    .from('bookings')
    .select('booking_type, accom_type')
    .eq('id', bookingId)
    .maybeSingle();
  const portalType = isCommuteBooking(bkType) ? 'commute' : 'all_in_one';

  // Supabase Auth 계정 생성
  const email = `${username}@dreamacademyph.com`;
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { portal_type: portalType, booking_id: bookingId }
  });
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // bookings 테이블 업데이트
  const { data: updated, error: dbError } = await supabaseAdmin
    .from('bookings')
    .update({
      portal_username: username,
      portal_user_id: authData.user.id,
      portal_temp_pw: password
    })
    .eq('id', bookingId)
    .select('id, portal_username, portal_user_id');

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, username, userId: authData.user.id, updated });
}

// 비번 재설정
export async function PATCH(req: NextRequest) {
  const { bookingId, newPassword } = await req.json();

  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('portal_user_id')
    .eq('id', bookingId)
    .single();

  if (!booking?.portal_user_id) {
    return NextResponse.json({ error: '계정 없음' }, { status: 404 });
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(
    booking.portal_user_id,
    { password: newPassword }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin
    .from('bookings')
    .update({ portal_temp_pw: newPassword })
    .eq('id', bookingId);

  return NextResponse.json({ success: true });
}
