import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  const { data: requests } = await supabase.from('tutor_requests').select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ requests: requests ?? [] })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { booking_id, guest_name } = body
    if (!booking_id) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

    // 필수 동의 체크
    if (!body.privacy_agreed || !body.rules_agreed) {
      return NextResponse.json({ error: '개인정보 동의와 튜터 규정 동의는 필수입니다.' }, { status: 400 })
    }

    const row: Record<string, unknown> = {
      booking_id,
      guest_name: guest_name || null,
      house_number: body.house_number || null,
      student_name_kr: body.student_name_kr || null,
      student_name_en: body.student_name_en || null,
      student_age: body.student_age || null,
      class_type: body.class_type || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      preferred_days_arr: body.preferred_days_arr || null,
      skip_dates: body.skip_dates || null,
      preferred_time: body.preferred_time || null,
      level_english: body.level_english || null,
      level_speaking: body.level_speaking || null,
      level_reading: body.level_reading || null,
      level_writing: body.level_writing || null,
      textbook: body.textbook || null,
      class_style: body.class_style || null,
      class_focus_arr: body.class_focus_arr || null,
      child_personality: body.child_personality || null,
      privacy_agreed: true,
      rules_agreed: true,
      status: 'pending',
    }

    const { data, error } = await supabase.from('tutor_requests').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const bookerName = guest_name || await getBookerName(booking_id)
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('staff_tasks').insert({
      title: `👩‍🏫 ${bookerName}님이 튜터 수업을 신청했습니다`,
      assignee: 'all', due: today, done: false, shared: true,
      note: `학생: ${body.student_name_kr || ''} (${body.student_name_en || ''})\n나이: ${body.student_age || '-'}\n유형: ${body.class_type || '-'}\n기간: ${body.start_date || '-'} ~ ${body.end_date || '-'}\n요일: ${(body.preferred_days_arr || []).join(',')}\n시간: ${body.preferred_time || '-'}`,
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

  const { data: existing } = await supabase.from('tutor_requests').select('status, created_at').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (existing.status !== 'pending') return NextResponse.json({ error: '이미 처리된 신청은 취소할 수 없습니다.' }, { status: 403 })
  const createdAt = new Date(existing.created_at).getTime()
  const daysSince = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24))
  if (daysSince >= 4) {
    return NextResponse.json({ error: '신청 후 4일 이상 경과하여 취소할 수 없습니다. 관리자에게 문의하세요.' }, { status: 403 })
  }
  const { error } = await supabase.from('tutor_requests').update({ status: 'cancelled' }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
