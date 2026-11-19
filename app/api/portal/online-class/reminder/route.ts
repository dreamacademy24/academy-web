import { NextResponse } from 'next/server';
import { portalDb, requireBooking } from '@/lib/portalAuth';
import { pendingOnlineApplications } from '@/lib/onlineApplicationReminder';

export async function GET(req: Request) {
  const bookingId = new URL(req.url).searchParams.get('booking_id');
  const denied = await requireBooking(req, bookingId);
  if (denied) return denied;
  const db = portalDb();
  const booking = await db.from('bookings').select('*').eq('id', bookingId!).single();
  if (booking.error) return NextResponse.json({ error: '예약을 확인하지 못했습니다.' }, { status: 503 });
  const uid = booking.data.portal_user_id;
  // The authorized booking determines the account, never a client-provided user ID.
  const related = uid ? await db.from('bookings').select('*').eq('portal_user_id', uid) : { data: [booking.data], error: null };
  if (related.error) return NextResponse.json({ error: '연결 예약 조회 실패' }, { status: 503 });
  const bookings = related.data || [];
  const [enrollments, sources] = await Promise.all([
    uid ? db.from('online_enrollments').select('id,student_name,status,enrollment_type,package_booking_id,package_plan').eq('customer_user_id', uid)
      : db.from('online_enrollments').select('id,student_name,status,enrollment_type,package_booking_id,package_plan').eq('package_booking_id', bookingId!),
    db.from('online_package_sources').select('booking_id,student_key,enrollment_id').in('booking_id', bookings.map(b => b.id)),
  ]);
  if (enrollments.error || sources.error) return NextResponse.json({ error: '신청 여부를 확인하지 못했습니다.' }, { status: 503 });
  return NextResponse.json({ pending: pendingOnlineApplications(bookings, enrollments.data || [], sources.data || []) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
