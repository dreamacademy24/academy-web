import { NextResponse } from 'next/server';
import { isPortalAdmin, portalDb } from '@/lib/portalAuth';
import { issueBooking3 } from '@/lib/booking3Server';

export async function GET(req: Request) {
  if (!await isPortalAdmin(req)) return NextResponse.json({ error: '직원 로그인이 필요합니다.' }, { status: 401 });
  const { data, error } = await portalDb().from('online_applications').select('id,payload,quote,status,existing_user_id,account_username,enrollment_id,created_at,updated_at').order('created_at', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: '신청 목록을 불러오지 못했습니다.' }, { status: 503 });
  return NextResponse.json({ applications: data }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: Request) {
  if (!await isPortalAdmin(req)) return NextResponse.json({ error: '직원 로그인이 필요합니다.' }, { status: 401 });
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== (req.headers.get('host') || new URL(req.url).host)) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 403 });
  try {
    const { id, startDate, action } = await req.json();
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('신청서를 선택해주세요.');
    if (action === 'reject') {
      const { data, error } = await portalDb().from('online_applications').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'pending').is('provision_user_id', null).is('account_cipher', null).select('id').maybeSingle();
      if (error || !data) throw new Error('발급을 시작했거나 처리 중인 신청은 취소할 수 없습니다.');
      return NextResponse.json({ ok: true });
    }
    if (action !== 'issue') throw new Error('처리 방법을 확인해주세요.');
    return NextResponse.json(await issueBooking3(id, startDate), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '발급에 실패했습니다.' }, { status: 409 }); }
}
