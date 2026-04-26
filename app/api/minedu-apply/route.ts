import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, children, ages, depart_date, duration_weeks, lodging } = body;

    // 필수 값 검증
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: '예약자 성함을 입력해주세요.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 메타데이터 수집
    const userAgent = request.headers.get('user-agent') || '';
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const ipHint = forwardedFor.split(',')[0].trim().slice(0, 50);

    // depart_date 검증 (YYYY-MM-DD 형식)
    let validDepartDate: string | null = null;
    if (depart_date && /^\d{4}-\d{2}-\d{2}$/.test(String(depart_date).trim())) {
      validDepartDate = String(depart_date).trim();
    }

    const { data, error } = await supabase
      .from('minedu_applications')
      .insert({
        name: String(name).trim().slice(0, 100),
        phone: phone ? String(phone).trim().slice(0, 50) : null,
        children: children ? String(children).trim().slice(0, 50) : null,
        ages: ages ? String(ages).trim().slice(0, 200) : null,
        depart_date: validDepartDate,
        duration_weeks: duration_weeks ? String(duration_weeks).trim().slice(0, 50) : null,
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
