import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const portalDb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const COOKIE = 'portal_staff_session';
function mac(value: string) {
  const key = process.env.STAFF_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Server authentication is not configured');
  return createHmac('sha256', key).update('portal-staff-v1:' + value).digest('base64url');
}
export function staffCookie(username: string) {
  const payload = Buffer.from(JSON.stringify({ username, expires: Date.now() + 8 * 3600000 })).toString('base64url');
  return { name: COOKIE, value: payload + '.' + mac(payload), httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: 8 * 3600 };
}
export async function portalStaffIdentity(req: Request): Promise<string | null> {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return null;
  try {
    const value = req.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
    if (!value) return null;
    const [payload, signature] = value.split('.');
    const expected = Buffer.from(mac(payload)); const actual = Buffer.from(signature || '');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const claim = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof claim.username !== 'string' || !Number.isFinite(claim.expires) || claim.expires <= Date.now()) return null;
    const { data, error } = await portalDb().from('staff_accounts').select('role').eq('username', claim.username).eq('is_active', true).maybeSingle();
    return !error && data?.role === 'korean_admin' ? claim.username : null;
  } catch { return null; }
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
