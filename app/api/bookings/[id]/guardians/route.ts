import { NextResponse } from 'next/server';
import { isPortalAdmin, portalDb } from '@/lib/portalAuth';
import { normalizeGuardians } from '@/lib/bookingGuardians';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isPortalAdmin(req)) return NextResponse.json({ error: '직원 로그인이 필요합니다.' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.booker_name !== 'string' || !body.booker_name.trim() || typeof body.booker_english !== 'string' || !Array.isArray(body.extra_guardians) || body.extra_guardians.length > 20) {
    return NextResponse.json({ error: '예약자 이름과 보호자 목록을 확인해주세요.' }, { status: 400 });
  }
  const guardians = normalizeGuardians(body.extra_guardians).filter(g => g.kor || g.eng);
  if ([body.booker_name, body.booker_english, ...guardians.flatMap(g => [g.kor, g.eng])].some(n => n.length > 100)) return NextResponse.json({ error: '이름은 100자 이내로 입력해주세요.' }, { status: 400 });
  const { data, error } = await portalDb().from('bookings').update({ booker_name: body.booker_name.trim(), booker_english: body.booker_english.trim(), extra_guardians: guardians }).eq('id', id).select('id,booker_name,booker_english,extra_guardians').maybeSingle();
  if (error) return NextResponse.json({ error: '보호자 정보를 저장하지 못했습니다.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: '예약을 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json({ booking: data });
}
