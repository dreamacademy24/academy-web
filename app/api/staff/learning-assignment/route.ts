import { NextResponse } from 'next/server';
import { getStaffIdentity, portalDb } from '@/lib/portalAuth';
import { describeAssignment, validLearningAssignment, type AssignmentRecord } from '@/lib/learning/catalog';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const failed = () => reply({ error: '학습 배정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요. / Learning assignment unavailable.' }, 503);
function databaseError(error: { code?: string; message?: string }) {
  if (error.code === '42501') return reply({ error: 'Access denied.' }, 403);
  if (error.code === '40001') return reply({ error: '다른 변경이 있습니다. 새로고침 후 다시 저장해주세요. / Refresh before saving changes.' }, 409);
  if (error.code === '22023') return reply({ error: '방문과 공식 단계, 배정 교재를 확인해주세요. / Check the visit, level and unit.' }, 400);
  return failed();
}
type AssignmentResponse = { assignment: AssignmentRecord | null; history: (AssignmentRecord & { actor_name: string })[]; canEdit: boolean; alreadySaved?: boolean };
function display(data: AssignmentResponse) {
  return {
    assignment: describeAssignment(data.assignment),
    history: data.history.map(row => ({ ...describeAssignment(row), actorName: row.actor_name })),
    canEdit: data.canEdit,
    ...(data.alreadySaved !== undefined ? { alreadySaved: data.alreadySaved } : {}),
  };
}
export async function GET(req: Request) {
  try {
    const staff = await getStaffIdentity(req);
    if (!staff) return reply({ error: 'Please sign in again. / 다시 로그인해주세요.' }, 401);
    if (!['korean_admin', 'local_teacher'].includes(staff.role)) return reply({ error: 'Access denied.' }, 403);
    const visitId = new URL(req.url).searchParams.get('visitId');
    if (!uuid(visitId)) return reply({ error: '유효한 방문을 선택해주세요.' }, 400);
    const { data, error } = await portalDb().rpc('get_care_learning_assignment', { p_actor_id: staff.id, p_visit_id: visitId });
    if (error) return databaseError(error);
    return reply(display(data as AssignmentResponse));
  } catch { return failed(); }
}
export async function POST(req: Request) {
  try {
    const staff = await getStaffIdentity(req);
    if (!staff) return reply({ error: 'Please sign in again. / 다시 로그인해주세요.' }, 401);
    if (staff.role !== 'korean_admin') return reply({ error: 'Access denied.' }, 403);
    const raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > 8192) return reply({ error: '요청이 너무 큽니다.' }, 413);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return reply({ error: '올바른 요청을 보내주세요.' }, 400); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return reply({ error: '올바른 요청을 보내주세요.' }, 400);
    const body = input as Record<string, unknown>;
    if (!uuid(body.visitId) || !uuid(body.requestId) || !(body.expectedAssignmentId === null || uuid(body.expectedAssignmentId))
      || !validLearningAssignment(body.levelCode, body.unitId)) return reply({ error: '방문과 공식 단계, 배정 교재를 확인해주세요.' }, 400);
    const { data, error } = await portalDb().rpc('set_care_learning_assignment', {
      p_actor_id: staff.id, p_request_id: body.requestId, p_visit_id: body.visitId,
      p_previous_id: body.expectedAssignmentId, p_level_code: body.levelCode, p_unit_id: body.unitId,
    });
    if (error) return databaseError(error);
    return reply(display(data as AssignmentResponse));
  } catch { return failed(); }
}
