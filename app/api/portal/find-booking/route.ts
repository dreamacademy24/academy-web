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
  //    ⚠️ 한 계정에 예약이 여러 건일 수 있음(재방문/형제) → maybeSingle 금지, 최신 예약 우선
  const { data: linked } = await supabase
    .from('bookings')
    .select('id, reservation_no, booker_name, status, accom_type')
    .eq('portal_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (linked && linked.length) return NextResponse.json({ booking: linked[0] });

  // 2. 이메일에서 예약번호 마지막 4자리 추출 → 자동 매칭
  //    ⚠️ 동명이인/번호 꼬리 중복 사고 방지: "후보가 정확히 1건" + "가입자 이름 = 예약자 이름"일 때만 자동 링크
  const { data: authData } = await supabase.auth.admin.getUserById(userId);
  const email = authData?.user?.email || '';
  const portalId = email.split('@')[0].toLowerCase(); // e.g. "ash0370"
  const last4 = portalId.slice(-4); // "0370"

  if (last4 && /^\d{4}$/.test(last4)) {
    const { data: candidates } = await supabase
      .from('bookings')
      .select('id, reservation_no, booker_name, status, accom_type, portal_user_id')
      .ilike('reservation_no', `%${last4}`)
      .limit(5);

    const list = (candidates || []).filter(b => !b.portal_user_id); // 이미 다른 계정에 연결된 예약 제외
    if (list.length === 1) {
      // 이름 검증: 가입자 이름(user_metadata 또는 profiles.name)과 예약자명이 일치해야만 자동 링크
      const metaName = String(authData?.user?.user_metadata?.name || '').replace(/\s+/g, '');
      let profName = '';
      try {
        const { data: prof } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle();
        profName = String(prof?.name || '').replace(/\s+/g, '');
      } catch { /* profiles 없으면 metaName만 */ }
      const bn = String(list[0].booker_name || '').replace(/\s+/g, '');
      const nameOk = !!bn && (bn === metaName || bn === profName);

      if (nameOk) {
        await supabase
          .from('bookings')
          .update({ portal_user_id: userId })
          .eq('id', list[0].id);
        return NextResponse.json({ booking: list[0] });
      }
    }
    // 후보 0건/2건 이상, 또는 이름 불일치 → 자동 연결하지 않음 (예약 조회에서 예약번호+이름으로 확인)
  }

  return NextResponse.json({ booking: null });
}
