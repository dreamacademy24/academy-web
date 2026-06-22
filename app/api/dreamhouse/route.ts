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
    const { data: check } = await supabase.from('bookings').select('room_locked').eq('id', id).single()
    if (check?.room_locked) return NextResponse.json({ error: '🔒 이 예약은 룸이 잠겨있어 변경할 수 없습니다.' }, { status: 403 })

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
