import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { DH_ROOMS } from '@/lib/dhRooms'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* GET /api/dreamhouse/availability?ci=YYYY-MM-DD&co=YYYY-MM-DD
   해당 기간 드림하우스 점유(활성 예약, 룸 미배정 포함)를 날짜별로 세서 만실 여부 반환.
   점유 구간은 [체크인, 체크아웃) — 당일 전환(체크아웃일 새 체크인)은 허용. 콤보는 DH seg 구간만. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const ci = String(searchParams.get('ci') || '').slice(0, 10)
    const co = String(searchParams.get('co') || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ci) || !/^\d{4}-\d{2}-\d{2}$/.test(co) || ci >= co) {
      return NextResponse.json({ error: 'ci/co(YYYY-MM-DD, ci<co) 필요' }, { status: 400 })
    }
    const CAP = DH_ROOMS.length
    const { data } = await supabase
      .from('bookings')
      .select('id, accom_type, booking_type, checkin_date, checkout_date, late_checkout, status, seg1_type, seg1_checkin, seg1_checkout, seg2_type, seg2_checkin, seg2_checkout')
      .lt('checkin_date', co)
      .gte('checkout_date', ci)
      .not('status', 'ilike', '%취소%')

    type Range = { ci: string; co: string }
    const ranges: Range[] = []
    for (const b of (data || [])) {
      const bt = String(b.booking_type || '')
      const at = String(b.accom_type || '')
      if (bt.includes('commute') || at.includes('통학')) continue
      const segs = [
        [b.seg1_type, b.seg1_checkin, b.seg1_checkout],
        [b.seg2_type, b.seg2_checkin, b.seg2_checkout],
      ].filter(x => x[0])
      const addDay = (d: string) => { const t = new Date(d + 'T00:00:00'); t.setDate(t.getDate() + 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
      const eff = (rco: string) => (b.late_checkout && rco === String(b.checkout_date || '').slice(0, 10)) ? addDay(rco) : rco
      if (segs.length) {
        const dh = segs.find(x => String(x[0]) === 'dreamhouse')
        if (!dh) continue
        const rci = String(dh[1] || '').slice(0, 10), rco = String(dh[2] || '').slice(0, 10)
        if (rci && rco) ranges.push({ ci: rci, co: eff(rco) })
        continue
      }
      if (!(at.includes('드림하우스') || bt.startsWith('dreamhouse'))) continue
      const rci = String(b.checkin_date || '').slice(0, 10), rco = String(b.checkout_date || '').slice(0, 10)
      if (rci && rco) ranges.push({ ci: rci, co: eff(rco) })
    }

    // 날짜별 점유 카운트 ([ci, co) 구간)
    const fullDates: string[] = []
    let maxOccupancy = 0
    const d = new Date(ci + 'T00:00:00')
    const end = new Date(co + 'T00:00:00')
    while (d < end) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      let cnt = 0
      for (const r of ranges) if (r.ci <= ds && ds < r.co) cnt++
      if (cnt > maxOccupancy) maxOccupancy = cnt
      if (cnt >= CAP) fullDates.push(ds)
      d.setDate(d.getDate() + 1)
    }
    return NextResponse.json({ capacity: CAP, maxOccupancy, remaining: Math.max(0, CAP - maxOccupancy), fullDates })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
