import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// CORS 허용 (정적 HTML에서 fetch 호출 가능하도록)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Preflight 요청 대응
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, children, ages, period, lodging } = body;

    // 필수 값 검증
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: '예약자 성함을 입력해주세요.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Supabase 클라이언트 (서비스 키 사용 - 서버 사이드)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 메타데이터 수집 (스팸 방지/통계용)
    const userAgent = request.headers.get('user-agent') || '';
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const ipHint = forwardedFor.split(',')[0].trim().slice(0, 50); // 일부만 저장

    // INSERT
    const { data, error } = await supabase
      .from('minedu_applications')
      .insert({
        name: String(name).trim().slice(0, 100),
        phone: phone ? String(phone).trim().slice(0, 50) : null,
        children: children ? String(children).trim().slice(0, 50) : null,
        ages: ages ? String(ages).trim().slice(0, 200) : null,
        period: period ? String(period).trim().slice(0, 200) : null,
        lodging: lodging ? String(lodging).trim().slice(0, 100) : null,
        user_agent: userAgent.slice(0, 500),
        ip_hint: ipHint,
      })
      .select()
      .single();

    if (error) {
      console.error('[minedu-apply] Supabase error:', error);
      return NextResponse.json(
        { error: '신청 저장 중 오류가 발생했습니다. 다시 시도해주세요.' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { success: true, id: data.id },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error('[minedu-apply] Unexpected error:', err);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500, headers: corsHeaders }
    );
  }
}
