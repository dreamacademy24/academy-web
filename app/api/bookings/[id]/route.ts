import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// students 테이블 행이 없을 때 booking.students JSON에서 변환 (옛 데이터 호환)
function parseBookingStudents(raw: unknown): Array<Record<string, unknown>> {
  if (!raw) return []
  let arr: Array<Record<string, unknown>> = []
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw) } catch { return [] }
  } else if (Array.isArray(raw)) {
    arr = raw as Array<Record<string, unknown>>
  } else {
    return []
  }
  return arr
    .filter((s) => s && (s.korName || s.name_kr))
    .map((s) => ({
      ...s, // 원본 JSONB 필드 보존 (academyStart/ssp/address 등 유실 방지)
      booking_id: null,
      name_kr: (s.korName ?? s.name_kr ?? '') as string,
      name_en: (s.engName ?? s.name_en ?? null) as string | null,
      age: s.age ?? null,
      level: (s.level ?? (s.grade === '킨더' ? 'kinder' : 'junior')) as string,
      academy_start: (s.academy_start ?? s.academyStart ?? null) as string | null,
      academy_end: (s.academy_end ?? s.academyEnd ?? null) as string | null,
      ssp: s.ssp ?? null,
      class_type: s.class_type ?? null,
      pickup_location: (s.pickup_location ?? s.pickup ?? null) as string | null,
      address_detail: (s.address_detail ?? s.address ?? null) as string | null,
      special_request: (s.special_request ?? s.request ?? null) as string | null,
      photo_allowed: (s.photo_allowed ?? s.photo === 'O') as boolean,
      _source: 'booking_json',
    }))
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [booking, students, pickups, checkin, invoices, accommodations, tutorReqs, shuttleReqs] = await Promise.all([
    supabase.from('bookings_new').select('*').eq('id', id).maybeSingle(),
    supabase.from('students').select('*').eq('booking_id', id).order('name_kr'),
    supabase.from('pickup_requests').select('*').eq('booking_id', id).order('request_date'),
    supabase.from('checkin_details').select('*').eq('booking_id', id).maybeSingle(),
    supabase.from('invoices_new').select('*').eq('booking_id', id).order('created_at'),
    supabase.from('booking_accommodations').select('*').eq('booking_id', id),
    supabase.from('tutor_requests').select('*').eq('booking_id', id).order('created_at', { ascending: false }),
    supabase.from('shuttle_requests').select('*').eq('booking_id', id).order('request_date', { ascending: false }),
  ])

  // 구 bookings 예약: shuttle/pickup은 notes에서 portal_booking_id 검색
  let shuttleExtra: Array<Record<string, unknown>> = []
  let pickupExtra: Array<Record<string, unknown>> = []
  if (!booking.data) {
    // fallback: old bookings
    const { data: oldBooking } = await supabase.from('bookings').select('*').eq('id', id).maybeSingle()
    if (!oldBooking) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const [sh, pk] = await Promise.all([
      supabase.from('shuttle_requests').select('*').ilike('notes', `%portal_booking_id:${id}%`),
      supabase.from('pickup_requests').select('*').ilike('notes', `%portal_booking_id:${id}%`),
    ])
    shuttleExtra = sh.data ?? []
    pickupExtra = pk.data ?? []

    return NextResponse.json({
      booking: oldBooking, source: 'old',
      students: (students.data && students.data.length > 0) ? students.data : parseBookingStudents(oldBooking.students),
      pickups: [...(pickups.data ?? []), ...pickupExtra],
      checkin: checkin.data, invoices: invoices.data ?? [],
      accommodations: accommodations.data ?? [],
      tutor_requests: tutorReqs.data ?? [],
      shuttle_requests: [...(shuttleReqs.data ?? []), ...shuttleExtra],
    })
  }

  return NextResponse.json({
    booking: booking.data, source: 'new',
    students: (students.data && students.data.length > 0) ? students.data : parseBookingStudents(booking.data.students),
    pickups: pickups.data ?? [],
    checkin: checkin.data, invoices: invoices.data ?? [],
    accommodations: accommodations.data ?? [],
    tutor_requests: tutorReqs.data ?? [],
    shuttle_requests: shuttleReqs.data ?? [],
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  // bookings_new 우선, 없으면 bookings (live 테이블)
  const newRow = await supabase.from('bookings_new').update(body).eq('id', id).select().maybeSingle()
  let updatedBooking: Record<string, unknown> | null = null
  let source: 'new' | 'old' = 'new'
  if (newRow.data) {
    updatedBooking = newRow.data
  } else {
    const oldRow = await supabase.from('bookings').update(body).eq('id', id).select().maybeSingle()
    if (oldRow.error) return NextResponse.json({ error: oldRow.error.message }, { status: 400 })
    if (!oldRow.data) return NextResponse.json({ error: 'not found' }, { status: 404 })
    updatedBooking = oldRow.data
    source = 'old'
  }

  // academy_start/end가 변경된 경우 — students 테이블 + bookings.students JSONB 양쪽 동기화
  if (body && (body.academy_start !== undefined || body.academy_end !== undefined)) {
    // 1) students 테이블 (snake_case)
    const stuPatch: Record<string, unknown> = {}
    if (body.academy_start !== undefined) stuPatch.academy_start = body.academy_start
    if (body.academy_end !== undefined) stuPatch.academy_end = body.academy_end
    if (Object.keys(stuPatch).length > 0) {
      const stuRes = await supabase.from('students').update(stuPatch).eq('booking_id', id).select()
      console.log('[PATCH /api/bookings] students sync:', { booking_id: id, patch: stuPatch, rows: stuRes.data?.length ?? 0, error: stuRes.error?.message })
    }

    // 2) bookings.students JSONB (camelCase) — 학생관리 달력은 이쪽을 source로 읽음
    const raw = (updatedBooking as any)?.students
    let arr: Array<Record<string, unknown>> = []
    try {
      arr = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : [])
    } catch { arr = [] }
    if (Array.isArray(arr) && arr.length > 0) {
      const patched = arr.map(s => {
        const next = { ...s }
        if (body.academy_start !== undefined) {
          next.academyStart = body.academy_start
          next.academy_start = body.academy_start
        }
        if (body.academy_end !== undefined) {
          next.academyEnd = body.academy_end
          next.academy_end = body.academy_end
        }
        return next
      })
      const tbl = source === 'new' ? 'bookings_new' : 'bookings'
      const jsonbRes = await supabase.from(tbl).update({ students: patched }).eq('id', id).select().maybeSingle()
      console.log('[PATCH /api/bookings] JSONB sync:', { table: tbl, items: patched.length, error: jsonbRes.error?.message })
      if (jsonbRes.data) updatedBooking = jsonbRes.data
    }
  }

  return NextResponse.json({ booking: updatedBooking, source })
}
