import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { STAFF_COOKIE, signStaffSession, resolveStaffSession } from './staffSession';

export const portalDb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
function staffKey() { return process.env.STAFF_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''; }
export function staffCookie(username: string) {
  return { name: STAFF_COOKIE, value: signStaffSession(username, staffKey()), httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: 8 * 3600 };
}
export async function getStaffIdentity(req: Request) {
  return resolveStaffSession(req, staffKey(), async username => {
    const {data,error}=await portalDb().from('staff_accounts').select('id,username,role,name').eq('username',username).eq('is_active',true).maybeSingle();
    if(error)throw error;
    return data;
  });
}
export async function portalStaffIdentity(req: Request): Promise<string | null> {
  const staff=await getStaffIdentity(req);
  return staff?.role==='korean_admin'?staff.username:null;
}
export async function isPortalAdmin(req: Request) {
  return !!(await portalStaffIdentity(req));
}
export async function portalUser(req: Request) {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await portalDb().auth.getUser(token);
  return error ? null : data.user;
}
export async function requireBooking(req: Request, bookingId: unknown) {
  if (typeof bookingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(bookingId)) return NextResponse.json({ error: '유효한 예약이 필요합니다.' }, { status: 400 });
  if (await isPortalAdmin(req)) return null;
  const user = await portalUser(req);
  if (!user) return NextResponse.json({ error: '다시 로그인해주세요.' }, { status: 401 });
  const { data, error } = await portalDb().from('bookings').select('id').eq('id', bookingId).eq('portal_user_id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: '예약 권한 확인에 실패했습니다.' }, { status: 503 });
  return data ? null : NextResponse.json({ error: '본인 예약만 이용할 수 있습니다.' }, { status: 403 });
}
export async function requireApplication(req: Request, table: string, id: unknown) {
  if (!['shuttle_applications','fieldtrip_applications','tutor_requests','pickup_requests'].includes(table) || typeof id !== 'string') return NextResponse.json({ error: '유효하지 않은 신청입니다.' }, { status: 400 });
  const { data, error } = await portalDb().from(table).select('*').eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: '신청 확인에 실패했습니다.' }, { status: 503 });
  if (!data) return NextResponse.json({ error: '신청을 찾을 수 없습니다.' }, { status: 404 });
  const legacy = table === 'pickup_requests' && !data.booking_id ? String(data.notes || '').match(/^portal_booking_id:([0-9a-f-]{36})$/i)?.[1] : null;
  return requireBooking(req, data.booking_id || legacy);
}
