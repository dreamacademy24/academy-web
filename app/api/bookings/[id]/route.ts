import { workspaceStaffIdentity } from '@/lib/portalAuth';
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
  const currentNew = await supabase.from('bookings_new').select('*').eq('id', id).maybeSingle()
  const current = currentNew.data || (await supabase.from('bookings').select('*').eq('id', id).maybeSingle()).data
  if (!current) return NextResponse.json({error:'not found'},{status:404})
  const commute = (body.booking_type ?? current.booking_type) === 'commute' || (body.accom_type ?? current.accom_type) === '통학형'
  const scheduleChanged = ['checkin_date','checkout_date','academy_start','academy_end'].some(k => body[k] !== undefined && body[k] !== current[k])
  if (commute && scheduleChanged) {
    const start = body.checkin_date ?? body.academy_start ?? current.academy_start ?? current.checkin_date
    const end = body.checkout_date ?? body.academy_end ?? current.academy_end ?? current.checkout_date
    const valid = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v
    if (!valid(start) || !valid(end) || end < start) return NextResponse.json({error:'수업 시작일과 종료일을 확인해주세요. 종료일은 시작일 이후여야 합니다.'},{status:400})
    Object.assign(body,{checkin_date:start,checkout_date:end,academy_start:start,academy_end:end,accom_weeks:Math.ceil((Date.parse(end)-Date.parse(start)+86400000)/604800000)})
  }
  if (['portal_user_id','portal_username','portal_temp_pw'].some(key => Object.prototype.hasOwnProperty.call(body,key))) {
    if (!(await workspaceStaffIdentity(req))) return NextResponse.json({error:'직원 로그인 후 연결해주세요.'},{status:403});
    if (!Object.prototype.hasOwnProperty.call(body,'portal_user_id')) return NextResponse.json({error:'계정 연결 또는 비밀번호 재설정 기능을 이용해주세요.'},{status:400});
    if (body.portal_user_id) {
      const {data,error}=await supabase.auth.admin.getUserById(body.portal_user_id);
      if(error||!data.user?.email) return NextResponse.json({error:'유효한 계정을 선택해주세요.'},{status:400});
      body.portal_username=data.user.email.split('@')[0];
    } else {body.portal_username=null;}
    // 연결 대상의 실제 비밀번호를 알 수 없으므로 이전 계정의 임시 비밀번호를 표시하지 않는다.
    body.portal_temp_pw=null;
  }
  // 예약유형이 콤보(+)가 아닌 값으로 변경되면 콤보 잔재(seg1/seg2·큐브 필드) 자동 정리
  if (body && typeof body.accom_type === 'string' && !body.accom_type.includes('+')) {
    Object.assign(body, {
      seg1_type: null, seg1_checkin: null, seg1_checkout: null,
      seg2_type: null, seg2_checkin: null, seg2_checkout: null,
    })
    if (!body.accom_type.includes('큐브')) { body.cn_period = null; body.cn_room_type = null; body.cn_weeks = null }
    if (!body.accom_type.includes('제이파크')) { body.jp_room_type = null; body.jp_weeks = null }
    if (!body.accom_type.includes('드림하우스')) { body.dh_weeks = null }
  }
  // bookings_new 우선, 없으면 bookings (live 테이블)
  const newRow = currentNew.data ? await supabase.from('bookings_new').update(body).eq('id', id).select().maybeSingle() : {data:null,error:null}
  if (newRow.error) return NextResponse.json({error:newRow.error.message},{status:400})
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
      if (stuRes.error) return NextResponse.json({error:'예약은 저장됐지만 학생 일정 동기화에 실패했습니다. 다시 저장해주세요: '+stuRes.error.message},{status:500})
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
        if (commute && scheduleChanged) next.academyWeeks = String(body.accom_weeks)
        return next
      })
      const tbl = source === 'new' ? 'bookings_new' : 'bookings'
      const jsonbRes = await supabase.from(tbl).update({ students: patched }).eq('id', id).select().maybeSingle()
      if (jsonbRes.error) return NextResponse.json({error:'학생 명단 동기화에 실패했습니다. 다시 저장해주세요: '+jsonbRes.error.message},{status:500})
      if (jsonbRes.data) updatedBooking = jsonbRes.data
    }
  }

  if (commute && (body.academy_start !== undefined || body.academy_end !== undefined)) {
    const snapshot = await supabase.from('invoice_snapshots').select('saved_data').eq('booking_id',id).maybeSingle()
    if (snapshot.error) return NextResponse.json({error:'인보이스 일정 조회 실패: '+snapshot.error.message},{status:500})
    if (snapshot.data?.saved_data) {
      const saved = snapshot.data.saved_data
      const next = {...saved,students:Array.isArray(saved.students)?saved.students.map((s:Record<string,unknown>)=>({
        ...s,
        ...(body.academy_start !== undefined ? {academyStart:body.academy_start,academy_start:body.academy_start}:{}),
        ...(body.academy_end !== undefined ? {academyEnd:body.academy_end,academy_end:body.academy_end}:{}),
        ...(scheduleChanged ? {academyWeeks:String(body.accom_weeks)}:{})
      })):saved.students}
      const sync = await supabase.from('invoice_snapshots').update({saved_data:next}).eq('booking_id',id)
      if (sync.error) return NextResponse.json({error:'인보이스 일정 동기화 실패: '+sync.error.message},{status:500})
    }
  }
  return NextResponse.json({ booking: updatedBooking, source })
}

