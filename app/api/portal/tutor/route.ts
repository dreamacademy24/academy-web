import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getBookingStudents(bookingId: string) {
  const { data: students } = await supabase.from('students').select('id, name_kr, name_en').eq('booking_id', bookingId)
  return students ?? []
}

async function getBookerName(bookingId: string): Promise<string> {
  const { data: n } = await supabase.from('bookings_new').select('booker_name').eq('id', bookingId).maybeSingle()
  if (n) return n.booker_name
  const { data: o } = await supabase.from('bookings').select('booker_name').eq('id', bookingId).maybeSingle()
  return o?.booker_name || '손님'
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')
  if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

  const students = await getBookingStudents(bookingId)
  const studentIds = students.map(s => s.id)

  let requests: Array<Record<string, unknown>> = []
  if (studentIds.length > 0) {
    const { data } = await supabase.from('tutor_requests').select('*')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false })
    requests = (data ?? []).map(r => {
      const s = students.find(x => x.id === r.student_id)
      return { ...r, student_name: s?.name_kr || '-' }
    })
  }

  // 튜터 목록 (활성만)
  const { data: tutors } = await supabase.from('tutors').select('id, name, specialty').eq('is_active', true).order('name')

  return NextResponse.json({ requests, students, tutors: tutors ?? [] })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { booking_id, student_id, tutor_id, preferred_days, preferred_time, notes } = body
    if (!booking_id || !student_id) return NextResponse.json({ error: 'booking_id, student_id required' }, { status: 400 })

    const { data, error } = await supabase.from('tutor_requests').insert({
      student_id,
      tutor_id: tutor_id || null,
      preferred_days: preferred_days || null,
      preferred_time: preferred_time || null,
      notes: notes || null,
      status: 'pending',
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const bookerName = await getBookerName(booking_id)
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('staff_tasks').insert({
      title: `👩‍🏫 ${bookerName}님이 튜터 수업을 신청했습니다`,
      assignee: 'all', due: today, done: false, shared: true,
      note: `예약 ID: ${booking_id}\n학생 ID: ${student_id}\n희망 요일: ${preferred_days || '-'}\n희망 시간: ${preferred_time || '-'}\n튜터: ${tutor_id || '배정 전'}`,
    })
    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // 신청일 기준으로 취소 가능 기간 체크: created_at + 4일 이내인지 확인
  const { data: existing } = await supabase.from('tutor_requests').select('status, created_at').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (existing.status !== 'pending') return NextResponse.json({ error: '이미 처리된 신청은 취소할 수 없습니다.' }, { status: 403 })
  // 4일 규정 체크 (신청 후 4일 이상 경과 시 취소 불가)
  const createdAt = new Date(existing.created_at).getTime()
  const now = Date.now()
  const daysSince = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24))
  if (daysSince >= 4) {
    return NextResponse.json({ error: '신청 후 4일 이상 경과하여 취소할 수 없습니다. 관리자에게 문의하세요.' }, { status: 403 })
  }

  const { error } = await supabase.from('tutor_requests').update({ status: 'cancelled' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
