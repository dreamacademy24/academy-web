import { createHash, createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { portalDb, portalUser } from '@/lib/portalAuth';
import { BOOKING3_VERSION, booking3Quote, validateBooking3 } from '@/lib/booking3';

export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    if (origin && new URL(origin).host !== (req.headers.get('host') || new URL(req.url).host)) return NextResponse.json({ error: '신청 페이지에서 다시 접수해주세요.' }, { status: 403 });
    const raw = await req.text();
    if (raw.length > 12000) return NextResponse.json({ error: '입력 내용이 너무 깁니다.' }, { status: 413 });
    const body = JSON.parse(raw);
    if (body.website) return NextResponse.json({ error: '신청 내용을 확인해주세요.' }, { status: 400 });
    if (typeof body.requestKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestKey)) throw new Error('신청 페이지를 새로 열어주세요.');
    const payload = validateBooking3(body.form);
    const quote = booking3Quote(payload.weekly, payload.months);
    const user = body.useExisting ? await portalUser(req) : null;
    if (body.useExisting && !user) return NextResponse.json({ error: '기존 앱 계정으로 다시 로그인해주세요.' }, { status: 401 });
    const ip = req.headers.get('x-vercel-forwarded-for')?.split(',')[0] || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ipHash = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(ip).digest('hex');
    const hash = createHash('sha256').update(JSON.stringify({ payload, user: user?.id || null })).digest('hex');
    const { data: id, error } = await portalDb().rpc('submit_online_application', { p_key: body.requestKey, p_hash: hash, p_ip: ipHash, p_payload: payload, p_quote: quote, p_version: BOOKING3_VERSION, p_user: user?.id || null });
    if (error) {
      if (error.message.includes('RATE_LIMIT')) return NextResponse.json({ error: '잠시 후 다시 접수해주세요. 이미 접수했다면 담당자에게 문의해주세요.' }, { status: 429 });
      if (error.message.includes('REQUEST_CONFLICT')) return NextResponse.json({ error: '이미 접수된 신청입니다. 내용 변경은 담당자에게 요청해주세요.' }, { status: 409 });
      return NextResponse.json({ error: '접수를 확인하지 못했습니다. 입력 내용을 유지한 채 다시 눌러주세요.' }, { status: 503 });
    }
    return NextResponse.json({ id, quote, status: 'received' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? '신청 내용을 확인해주세요.' : error instanceof Error ? error.message : '접수에 실패했습니다.' }, { status: 400 });
  }
}
