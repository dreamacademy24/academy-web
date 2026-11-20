import { NextResponse } from 'next/server';
import { getStaffIdentity, portalDb, requireBooking } from '@/lib/portalAuth';
import { HOTEL_PICKUP_MARKER } from '@/lib/checkinPickup';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
async function allowed(req: Request, id: string, token?: string) {
  if(token){const {data}=await portalDb().from('checkin_details').select('booking_id').eq('public_token',token).eq('booking_id',id).maybeSingle();return !!data;}
  const staff=await getStaffIdentity(req);
  if(staff && ['korean_admin','korean_staff'].includes(staff.role))return true;
  return !(await requireBooking(req,id));
}
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('bookingId');
  if (!uuid(id)) return reply({ error: '예약을 선택해주세요.' }, 400);
  if(!await allowed(req,id,new URL(req.url).searchParams.get('token') || undefined))return reply({error:'예약 접근 권한이 없습니다.'},403);
  const { data, error } = await portalDb().from('pickup_requests').select('id,request_date,request_time,location,destination,notes,status').eq('booking_id', id).in('request_type', ['pickup','arrival']).not('status', 'in', '(cancelled,취소)');
  return error ? reply({ error: error.message }, 500) : reply({ pickups: data });
}
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!uuid(b.bookingId) || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '') || !Number.isFinite(Date.parse(b.date)) || new Date(b.date).toISOString().slice(0,10) !== b.date || (b.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time)) || typeof b.location !== 'string' || !b.location.trim() || b.location.length > 200 || typeof b.destination !== 'string' || !b.destination.trim() || b.destination.length > 200 || typeof b.note !== 'string' || b.note.length > 2000) return reply({ error: '픽업 장소·날짜·도착 숙소를 확인해주세요.' }, 400);
  if(!await allowed(req,b.bookingId,b.token))return reply({error:'예약 접근 권한이 없습니다.'},403);
  const db = portalDb();
  const { data: booking, error: be } = await db.from('bookings').select('id,status,adults,children').eq('id', b.bookingId).maybeSingle();
  if (be) return reply({ error: be.message }, 500);
  if (!booking || /cancel|취소/i.test(booking.status || '')) return reply({ error: '유효한 예약이 아닙니다.' }, 400);
  const { data: rows, error } = await db.from('pickup_requests').select('id').eq('booking_id', b.bookingId).in('request_type', ['pickup','arrival']).not('status', 'in', '(cancelled,취소)');
  if (error) return reply({ error: error.message }, 500);
  if ((rows || []).length > 1 || (rows?.[0]?.id || null) !== (b.id || null)) return reply({ error: '픽업 내역이 변경되었거나 여러 건입니다. 차량 스케줄에서 기존 내역을 먼저 확인해주세요.' }, 409);
  const fields = { request_date: b.date, request_time: b.time || null, location: b.location.trim(), destination: b.destination.trim(), notes: `${HOTEL_PICKUP_MARKER}\n${b.note.replaceAll(HOTEL_PICKUP_MARKER, '').trim()}`, flight_info: null };
  const result = rows?.[0] ? await db.from('pickup_requests').update(fields).eq('id', rows[0].id).eq('booking_id', b.bookingId).select('id').single() : await db.from('pickup_requests').insert({ ...fields, booking_id: b.bookingId, request_type: 'pickup', num_people: Number(booking.adults || 0) + Number(booking.children || 0) || 1, status: 'pending' }).select('id').single();
  return result.error ? reply({ error: result.error.message }, 500) : reply({ id: result.data.id });
}
