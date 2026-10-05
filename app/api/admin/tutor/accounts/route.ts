import {getStaffIdentity, portalDb} from '@/lib/portalAuth';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
async function allowed(req: Request) {
  const staff = await getStaffIdentity(req);
  return staff && ['korean_admin','korean_staff','local_teacher'].includes(staff.role);
}
export async function GET(req: Request) {
  try {
    if (!await allowed(req)) return reply({error:'Staff login required / 직원 로그인이 필요합니다.'},403);
    const db = portalDb();
    const [a,t] = await Promise.all([
      db.from('staff_accounts').select('id,name,username').eq('role','local_teacher').eq('is_active',true).order('name'),
      db.from('tutors').select('id,name,is_active,staff_account_id').order('name'),
    ]);
    if (a.error || t.error) throw a.error || t.error;
    const linked = new Set((t.data || []).map(t => t.staff_account_id));
    return reply({accounts:(a.data || []).filter(a => !linked.has(a.id)),tutors:t.data || []});
  } catch { return reply({error:'Could not load teacher accounts. Please retry. / 교사 계정을 불러오지 못했습니다.'},503); }
}
export async function POST(req: Request) {
  try {
    if (!await allowed(req)) return reply({error:'Staff login required / 직원 로그인이 필요합니다.'},403);
    const b = await req.json();
    const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
    if (!uuid(b.account_id) || (b.tutor_id != null && !uuid(b.tutor_id))) return reply({error:'Select a teacher account / 교사 계정을 선택해주세요.'},400);
    const {data,error} = await portalDb().rpc('import_tutor_account',{p_account:b.account_id,p_tutor:b.tutor_id || null});
    if (error) return reply({error:'Could not import. Refresh and check the account or existing tutor. / 새로고침 후 계정과 기존 튜터를 확인해주세요.'},409);
    return reply({tutor:data});
  } catch { return reply({error:'Could not save. Please retry. / 저장하지 못했습니다.'},503); }
}
