import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { portalDb, requireBooking } from '@/lib/portalAuth';

async function loadBooking(id: string) {
  const { data, error } = await portalDb().from('bookings').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('예약 조회에 실패했습니다.');
  return data;
}
function amounts(b: Record<string, unknown>) {
  const total = Number(b.final_price ?? b.base_price ?? 0);
  const paid = Number(b.paid_amount ?? 0);
  return { total, paid, balance: Math.max(0, total - paid) };
}
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('booking_id');
  const denied = await requireBooking(req, id); if (denied) return denied;
  try {
    const b = await loadBooking(id!);
    if (!b) return NextResponse.json({ error: '예약을 찾을 수 없습니다.' }, { status: 404 });
    const { total, paid, balance } = amounts(b);
    return NextResponse.json({ booking_id: id, booker_name: b.booker_name, reservation_no: b.reservation_no, total_amount: total, paid_amount: paid, balance, payment_status: balance === 0 && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid', source: 'old' });
  } catch { return NextResponse.json({ error: '결제 정보 조회에 실패했습니다.' }, { status: 503 }); }
}
export async function PUT(req: Request) {
  try {
    const { booking_id } = await req.json();
    const denied = await requireBooking(req, booking_id); if (denied) return denied;
    const b = await loadBooking(booking_id);
    if (!b) return NextResponse.json({ error: '예약을 찾을 수 없습니다.' }, { status: 404 });
    const { paid, balance } = amounts(b);
    if (!Number.isSafeInteger(balance) || balance <= 0) return NextResponse.json({ error: '결제할 잔액이 없습니다.' }, { status: 409 });
    const payment_id = `portal-${randomUUID()}`;
    const { error } = await portalDb().from('portal_payment_orders').insert({ payment_id, booking_id, amount_krw: balance, paid_before: paid });
    if (error) return NextResponse.json({ error: '결제 준비에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
    return NextResponse.json({ payment_id, amount: balance });
  } catch { return NextResponse.json({ error: '결제 준비에 실패했습니다.' }, { status: 503 }); }
}
export async function POST(req: Request) {
  try {
    const { booking_id, payment_id } = await req.json();
    const denied = await requireBooking(req, booking_id); if (denied) return denied;
    if (typeof payment_id !== 'string') return NextResponse.json({ error: '결제번호가 필요합니다.' }, { status: 400 });
    const db = portalDb();
    const { data: order, error } = await db.from('portal_payment_orders').select('*').eq('payment_id', payment_id).eq('booking_id', booking_id).maybeSingle();
    if (error) return NextResponse.json({ error: '결제 주문 조회에 실패했습니다.' }, { status: 503 });
    if (!order) return NextResponse.json({ error: '이 예약의 결제 주문이 아닙니다.' }, { status: 400 });
    if (order.status === 'paid') return NextResponse.json({ ok: true, already_processed: true });
    const response = await fetch(`https://api.portone.io/payments/${encodeURIComponent(payment_id)}`, { headers: { Authorization: `PortOne ${process.env.PORTONE_API_SECRET}` }, cache: 'no-store' });
    if (!response.ok) return NextResponse.json({ error: '결제 확인에 실패했습니다. 다시 결제하지 말고 확인을 재시도해주세요.' }, { status: 502 });
    const payment = await response.json();
    if (payment.id !== payment_id || payment.status !== 'PAID' || payment.currency !== 'KRW' || payment.amount?.total !== order.amount_krw) return NextResponse.json({ error: '결제 정보가 주문과 일치하지 않습니다.' }, { status: 400 });
    const { data: result, error: saveError } = await db.rpc('finalize_portal_payment', { p_payment_id: payment_id, p_booking_id: booking_id, p_amount: order.amount_krw, p_raw: payment });
    if (saveError) return NextResponse.json({ error: '결제 확인 후 저장에 실패했습니다. 다시 결제하지 말고 확인을 재시도하거나 관리자에게 문의해주세요.' }, { status: 503 });
    if (!result?.already_processed) {
      await db.from('staff_tasks').insert({ title: '💳 손님 포트원 결제가 확인되었습니다', assignee: 'all', done: false, shared: true, note: `예약 ID: ${booking_id}\n결제번호: ${payment_id}\n금액: ₩${order.amount_krw}` }).then(() => {}, () => {});
    }
    return NextResponse.json(result);
  } catch { return NextResponse.json({ error: '결제 확인을 완료하지 못했습니다. 관리자에게 문의해주세요.' }, { status: 503 }); }
}
