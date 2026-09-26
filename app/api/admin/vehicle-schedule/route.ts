import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// /admin/* 클라이언트 게이트 뒤에서만 호출됨 — 기존 /api/admin/pickups 와 동일하게 service_role 사용
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const keyOf = (date: string) => `veh_sched:${date}`

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD
// 페이지가 필요한 모든 소스를 한 번에 반환 (샌드박스는 supabase 직접 못 열어서 API 경유)
export async function GET(req: Request) {
  const url = new URL(req.url)
  const from = (url.searchParams.get('from') || '').slice(0, 10)
  const to = (url.searchParams.get('to') || '').slice(0, 10)
  if (!from || !to) return NextResponse.json({ error: 'from/to required' }, { status: 400 })

  const BK_COLS = 'id, booker_name, status, accom_type, house_no, accom_room, pickup_place, drop_off, checkin_date, checkout_date, adults, children, flight_in, flight_in_date, flight_in_time, flight_in_airline, flight_in_no, flight_out, flight_out_date, flight_out_time, flight_out_airline, flight_out_no, seg1_type, seg1_checkin, seg1_checkout, seg2_type, seg2_checkin, seg2_checkout'

  const [pickupsRes, bookingsRes, driversRes, shuttlesRes, fieldtripsRes, scheduleRes, overridesRes] =
    await Promise.all([
      db.from('pickup_requests').select('*').gte('request_date', from).lte('request_date', to),
      // 항공편이 이 기간에 걸치는 예약(도착/출발/환승 파생용) — 체크아웃이 시작일 이후 & 체크인이 종료일 이전(겹침)
      db.from('bookings').select(BK_COLS).gte('checkout_date', from).lte('checkin_date', to).limit(3000),
      db.from('drivers').select('id, name').eq('is_active', true),
      db.from('shuttle_applications').select('*').gte('tour_date', from).lte('tour_date', to),
      db.from('fieldtrip_applications').select('*'),
      db.from('schedule_items').select('*').in('type', ['afterschool', 'fieldtrip']).eq('is_deployed', true),
      db.from('app_settings').select('key,value').like('key', 'veh_sched:%'),
    ])

  const bookings = bookingsRes.data ?? []
  const bMap = new Map(bookings.map((b) => [b.id, b]))
  const pickups = (pickupsRes.data ?? []).map((p) => ({ ...p, bookings: bMap.get(p.booking_id) || null }))

  // 예약자 실명 보강 (shuttle: booking_id → booker_name)
  const shuttles = (shuttlesRes.data ?? []).map((s) => ({
    ...s,
    booker_name: (s.booking_id && bMap.get(s.booking_id)?.booker_name) || s.portal_name || '',
  }))

  const overrides: Record<string, unknown> = {}
  for (const row of overridesRes.data ?? []) {
    const d = String(row.key).slice('veh_sched:'.length)
    if (d >= from && d <= to) overrides[d] = row.value
  }

  return NextResponse.json({
    pickups,
    bookings,
    drivers: driversRes.data ?? [],
    shuttles,
    fieldtrips: fieldtripsRes.data ?? [],
    scheduleItems: scheduleRes.data ?? [],
    overrides,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST { date, state:{ confirmed, overrides:{id:{driver_id,time,note}}, manual:[...] } }
export async function POST(req: Request) {
  let body: { date?: string; by?: string; state?: { confirmed?: boolean; overrides?: Record<string, { driver_id?: string | null; time?: string; note?: string }>; manual?: unknown[] } }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const date = (body.date || '').slice(0, 10)
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const state = {
    confirmed: !!body.state?.confirmed,
    overrides: body.state?.overrides || {},
    manual: Array.isArray(body.state?.manual) ? body.state!.manual : [],
    updated_by: body.by || 'admin',
    updated_at: new Date().toISOString(),
  }

  const { error } = await db.from('app_settings').upsert(
    { key: keyOf(date), value: state, updated_at: state.updated_at },
    { onConflict: 'key' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 원본 테이블 기사배정 반영 (다른 페이지 동기화): pk_ → pickup_requests, sh_ → shuttle_applications
  const writeThrough: PromiseLike<unknown>[] = []
  for (const [id, ov] of Object.entries(state.overrides)) {
    if (!('driver_id' in ov)) continue
    const drv = ov.driver_id || null
    if (id.startsWith('pk_')) {
      const realId = id.slice(3)
      writeThrough.push(db.from('pickup_requests').update({ driver_id: drv }).eq('id', realId))
    } else if (id.startsWith('sh_')) {
      const realId = id.slice(3)
      writeThrough.push(db.from('shuttle_applications').update({ driver_id: drv }).eq('id', realId))
    }
  }
  if (writeThrough.length) await Promise.allSettled(writeThrough)

  return NextResponse.json({ ok: true, state })
}
