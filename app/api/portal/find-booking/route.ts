import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { portalUser } from '@/lib/portalAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const user = await portalUser(req);
  if (!user) return NextResponse.json({ error: '다시 로그인해주세요.' }, { status: 401 });
  const userId = user.id;

  // 1. portal_user_id 직접 매칭 (이미 링크된 계정)
  //    ⚠️ 한 계정에 예약이 여러 건일 수 있음(재방문/형제) → 전체 반환(최신순)
  const { data: linked, error } = await supabase
    .from('bookings')
    .select('id, reservation_no, booker_name, status, accom_type, checkin_date, checkout_date')
    .eq('portal_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: '예약 조회에 실패했습니다.' }, { status: 503 });

  if (linked && linked.length) {
    // booking = 최신(하위호환), bookings = 이 계정의 전체 예약 목록
    return NextResponse.json({ booking: linked[0], bookings: linked });
  }

  // 계정 연결은 관리자 확인으로만 수행한다. 사용자가 수정 가능한 이름/이메일로 자동 연결하지 않는다.
  return NextResponse.json({ booking: null, bookings: [] });
}
