import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function loadBooking(bookingId: string) {
  const { data: oldB } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle()
  if (oldB) return { booking: oldB, source: 'old' as const }
  return null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')
  if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

  const result = await loadBooking(bookingId)
  if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const b = result.booking
  const total = b.total_amount || b.final_price || b.base_price || 0
  const paid = b.paid_amount || 0
  const balance = total - paid
  const paymentStatus = b.payment_status || (['영수증발행','결제완료','완료'].includes(b.status) ? 'paid' : balance === 0 && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid')

  return NextResponse.json({
    booking_id: bookingId,
    booker_name: b.booker_name,
    reservation_no: b.reservation_no || bookingId,
    total_amount: total,
    paid_amount: paid,
    balance,
    payment_status: paymentStatus,
    source: result.source,
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { booking_id, payment_id } = body
    if (!booking_id || !payment_id) {
      return NextResponse.json({ error: 'booking_id, payment_id required' }, { status: 400 })
    }

    const result = await loadBooking(booking_id)
    if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 })

    // 서버에서 잔액 재계산 (클라이언트가 보낸 금액은 신뢰하지 않음)
    const b = result.booking
    const total = b.total_amount || b.final_price || b.base_price || 0
    const prevPaid = b.paid_amount || 0
    const balance = total - prevPaid

    // 포트원 단건조회로 실제 결제 검증
    const verifyRes = await fetch(`https://api.portone.io/payments/${encodeURIComponent(payment_id)}`, {
      headers: { Authorization: `PortOne ${process.env.PORTONE_API_SECRET}` },
    })
    if (!verifyRes.ok) {
      return NextResponse.json({ error: '결제 조회에 실패했습니다.' }, { status: 400 })
    }
    const payment = await verifyRes.json()

    if (payment.status !== 'PAID') {
      return NextResponse.json({ error: '결제가 완료되지 않았습니다.' }, { status: 400 })
    }
    const paidAmount = payment.amount?.total
    if (typeof paidAmount !== 'number' || paidAmount !== balance) {
      return NextResponse.json({ error: '결제 금액이 일치하지 않습니다.' }, { status: 400 })
    }

    const bookerName = b.booker_name || '손님'
    const newPaid = prevPaid + paidAmount
    const newStatus = newPaid >= total && total > 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid'

    // 결제 이력 기록 (전용 테이블)
    await supabase.from('payments').insert({
      booking_id,
      provider: 'portone',
      payment_id,
      amount_krw: paidAmount,
      status: payment.status,
      raw: payment,
    })

    await supabase.from('bookings').update({
      paid_amount: newPaid,
      payment_status: newStatus,
      status: newStatus === 'paid' ? '결제완료' : result.booking.status,
    }).eq('id', booking_id)

    // 어드민 알림 태스크
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('staff_tasks').insert({
      title: `💳 ${bookerName}님이 포트원으로 결제했습니다`,
      assignee: 'all',
      due: today,
      done: false,
      shared: true,
      note: `예약 ID: ${booking_id}\n포트원 결제번호: ${payment_id}\n결제 금액(KRW): ₩${paidAmount.toLocaleString()}\n납입 합계: ₩${newPaid.toLocaleString()}`,
    })

    return NextResponse.json({ ok: true, new_paid: newPaid, new_status: newStatus })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
