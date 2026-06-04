import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// 상품페이지(/products) 독립 결제 검증 — 포털 결제(app/api/portal/payment)와 별개
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Accom = 'dreamhouse' | 'jpark' | 'cubenine'
const ACCOM_LABEL: Record<Accom, string> = {
  dreamhouse: '드림하우스',
  jpark: '제이파크',
  cubenine: '큐브나인',
}

// public/price.xlsx 를 읽어 (상품페이지와 동일 키 구조로) 정가 재계산
async function serverListPrice(origin: string, accom: Accom, room: string, w: number, p: number, k: number): Promise<number | null> {
  const res = await fetch(`${origin}/price.xlsx`)
  if (!res.ok) throw new Error('price.xlsx 로드 실패')
  const wb = XLSX.read(await res.arrayBuffer(), { type: 'array' })
  const names = wb.SheetNames
  const sheet =
    accom === 'jpark' ? (names.find((n) => n.includes('제이')) || names[1]) :
    accom === 'cubenine' ? (names.find((n) => n.includes('큐브')) || names[2]) :
    (names.find((n) => n.includes('하우스')) || names[0])
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[sheet], { header: 1, blankrows: false })
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (accom === 'dreamhouse') {
      // [기간, 보호자, 아이, 총인원, 정가, ...]
      if (Number(r[0]) === w && Number(r[1]) === p && Number(r[2]) === k) return Number(r[4])
    } else {
      // [룸타입, 기간, 보호자, 아이, 총인원, 정가, ...]
      if (String(r[0] ?? '').trim() === room && Number(r[1]) === w && Number(r[2]) === p && Number(r[3]) === k) return Number(r[5])
    }
  }
  return null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { payment_id, accom, roomType, weeks, parents, kids, buyer } = body
    if (!payment_id || !accom) {
      return NextResponse.json({ error: 'payment_id, accom required' }, { status: 400 })
    }
    if (!['dreamhouse', 'jpark', 'cubenine'].includes(accom)) {
      return NextResponse.json({ error: '잘못된 상품 정보입니다.' }, { status: 400 })
    }
    const w = Number(weeks), p = Number(parents), k = Number(kids)
    const room = String(roomType ?? '')

    // 서버에서 정가 재계산 (클라이언트가 보낸 금액은 신뢰하지 않음)
    const origin = new URL(req.url).origin
    const listPrice = await serverListPrice(origin, accom as Accom, room, w, p, k)
    if (!listPrice) {
      return NextResponse.json({ error: '해당 구성의 가격을 확인할 수 없습니다.' }, { status: 400 })
    }

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
    if (typeof paidAmount !== 'number' || paidAmount !== listPrice) {
      return NextResponse.json({ error: '결제 금액이 일치하지 않습니다.' }, { status: 400 })
    }

    const label = ACCOM_LABEL[accom as Accom]
    const config = `${label}${room ? ` ${room}` : ''} ${w}주 보호자${p}+아이${k}`
    const buyerName = String(buyer?.fullName || '손님')

    // 결제 이력 기록 (예약과 무관한 상품페이지 결제 → booking_id null)
    await supabase.from('payments').insert({
      booking_id: null,
      provider: 'portone',
      payment_id,
      amount_krw: paidAmount,
      status: payment.status,
      raw: {
        source: 'products_page',
        config: { accom, roomType: room, weeks: w, parents: p, kids: k },
        buyer,
        payment,
      },
    })

    // 어드민 알림 태스크
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('staff_tasks').insert({
      title: `🛒 상품페이지 결제: ${buyerName} / ${config} / ₩${paidAmount.toLocaleString()}`,
      assignee: 'all',
      due: today,
      done: false,
      shared: true,
      note: `상품페이지 결제\n구매자: ${buyerName}\n연락처: ${buyer?.phoneNumber || '-'}\n이메일: ${buyer?.email || '-'}\n구성: ${config}\n금액(KRW): ₩${paidAmount.toLocaleString()}\n포트원 결제번호: ${payment_id}`,
    })

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
