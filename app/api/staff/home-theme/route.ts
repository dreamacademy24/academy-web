import {NextResponse} from 'next/server';
import {getStaffIdentity, portalDb} from '@/lib/portalAuth';

export const dynamic = 'force-dynamic';
const themes = ['purple', 'teal', 'blue', 'orange'];
const reply = (body: unknown, status = 200) => NextResponse.json(body, {status, headers: {'Cache-Control': 'private, no-store', Vary: 'Cookie'}});

export async function GET(req: Request) {
  try {
    const staff = await getStaffIdentity(req);
    if (staff?.role !== 'korean_admin') return reply({error: '직원 로그인이 필요합니다.'}, 403);
    const {data, error} = await portalDb().from('app_settings').select('value').eq('key', 'staff_home_theme:' + staff.id).maybeSingle();
    if (error) throw error;
    return reply({theme: themes.includes(data?.value) ? data!.value : 'purple'});
  } catch { return reply({error: '색상 설정을 불러오지 못했습니다. 다시 시도해주세요.'}, 503); }
}

export async function PUT(req: Request) {
  try {
    const staff = await getStaffIdentity(req);
    if (staff?.role !== 'korean_admin') return reply({error: '직원 로그인이 필요합니다.'}, 403);
    const body = await req.json().catch(() => null);
    if (!body || !themes.includes(body.theme) || Object.keys(body).some(key => key !== 'theme')) return reply({error: '네 가지 색상 중 하나를 선택해주세요.'}, 400);
    const {error} = await portalDb().from('app_settings').upsert({key: 'staff_home_theme:' + staff.id, value: body.theme}, {onConflict: 'key'});
    if (error) throw error;
    return reply({theme: body.theme});
  } catch { return reply({error: '색상 설정을 저장하지 못했습니다. 다시 시도해주세요.'}, 503); }
}
