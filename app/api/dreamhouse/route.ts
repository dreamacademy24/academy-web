import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const firstDay = searchParams.get('firstDay')
  const lastDay = searchParams.get('lastDay')

  const { data, error } = await supabase
    .from('bookings')
    .select('id, accom_room, checkin_date, checkout_date, booker_name, reservation_no, status, students, room_locked, seg1_type, seg1_checkin, seg1_checkout, seg2_type, seg2_checkin, seg2_checkout')
    .not('accom_room', 'is', null)
    .neq('accom_room', '')
    .not('status', 'ilike', '%취소%')
    .lte('checkin_date', lastDay)
    .gte('checkout_date', firstDay)
    .order('checkin_date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/* 룸 변경 — service_role로 accom_room + house_no 동시 업데이트 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

    // 룸 잠금/해제
    if ('room_locked' in body) {
      const { data, error } = await supabase
        .from('bookings')
        .update({ room_locked: !!body.room_locked })
        .eq('id', id)
        .select('id, room_locked')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    // 룸 변경
    const { room } = body
    if (!room) return NextResponse.json({ error: 'room 필수' }, { status: 400 })

    // 잠금 여부 확인
    const { data: check } = await supabase.from('bookings').select('room_locked, checkin_date, checkout_date, late_checkout, booker_name, seg1_type, seg1_checkin, seg1_checkout, seg2_type, seg2_checkin, seg2_checkout').eq('id', id).single()
    if (check?.room_locked) return NextResponse.json({ error: '🔒 이 예약은 룸이 잠겨있어 변경할 수 없습니다.' }, { status: 403 })

    // ⛔ 오버부킹 차단: 같은 룸에 기간 겹치는 활성 예약이 있으면 저장 거부 (force=true로만 예외)
    if (!body.force) {
      // 내 점유 기간 (콤보면 드림하우스 seg 구간)
      let myCi = String(check?.checkin_date || '').slice(0, 10)
      let myCo = String(check?.checkout_date || '').slice(0, 10)
      const segs = [
        [check?.seg1_type, check?.seg1_checkin, check?.seg1_checkout],
        [check?.seg2_type, check?.seg2_checkin, check?.seg2_checkout],
      ].filter(x => x[0])
      if (segs.length) {
        const dh = segs.find(x => String(x[0]) === 'dreamhouse')
        if (dh) { myCi = String(dh[1] || myCi).slice(0, 10); myCo = String(dh[2] || myCo).slice(0, 10) }
      }
      if (myCi && myCo) {
        const { data: others } = await supabase
          .from('bookings')
          .select('id, booker_name, reservation_no, checkin_date, checkout_date, late_checkout, status, seg1_type, seg1_checkin, seg1_checkout, seg2_type, seg2_checkin, seg2_checkout')
          .neq('id', id)
          .ilike('accom_room', room)
          .not('status', 'ilike', '%취소%')
        const conflicts = (others || []).filter(o => {
          let ci = String(o.checkin_date || '').slice(0, 10)
          let co = String(o.checkout_date || '').slice(0, 10)
          const os = [
            [o.seg1_type, o.seg1_checkin, o.seg1_checkout],
            [o.seg2_type, o.seg2_checkin, o.seg2_checkout],
          ].filter(x => x[0])
          if (os.length) {
            const dh = os.find(x => String(x[0]) === 'dreamhouse')
            if (!dh) return false
            ci = String(dh[1] || ci).slice(0, 10); co = String(dh[2] || co).slice(0, 10)
          }
          if (!ci || !co) return false
          // 당일 전환(체크아웃=체크인)은 허용 — 단, 레이트 체크아웃(22:30)이면 당일도 점유로 간주 (+1일)
          const addDay = (d: string) => { const t = new Date(d + 'T00:00:00'); t.setDate(t.getDate() + 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
          const oCoEff = (o.late_checkout && co === String(o.checkout_date || '').slice(0, 10)) ? addDay(co) : co
          const myCoEff = (check?.late_checkout && myCo === String(check?.checkout_date || '').slice(0, 10)) ? addDay(myCo) : myCo
          return ci < myCoEff && oCoEff > myCi
        })
        if (conflicts.length) {
          return NextResponse.json({
            error: 'room_conflict',
            conflicts: conflicts.map(c => ({ booker_name: c.booker_name, reservation_no: c.reservation_no, checkin: c.checkin_date, checkout: c.checkout_date })),
          }, { status: 409 })
        }
      }
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ accom_room: room, house_no: room })
      .eq('id', id)
      .select('id, accom_room, house_no')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
