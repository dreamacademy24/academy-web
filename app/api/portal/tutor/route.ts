import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 포털 한글 값 → tutor_applications 영문 코드 변환 맵
const DAY_MAP: Record<string, string> = { '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', '금': 'fri', '토': 'sat' }
const OVERALL_LEVEL_MAP: Record<string, string> = { '제로베이스': 'zero', '비기너': 'beginner', '미디엄': 'intermediate', '어드밴스': 'advanced' }
const SUB_LEVEL_MAP: Record<string, string> = { '제로베이스': 'zero', '비기너1': 'beginner1', '비기너2': 'beginner2', '미디엄1': 'intermediate1', '미디엄2': 'intermediate2', '어드밴스1': 'advanced1', '어드밴스2': 'advanced2' }
const STYLE_MAP: Record<string, string> = { '놀이식': 'play', '학습식': 'study', '놀이+학습': 'combined' }
const FOCUS_MAP: Record<string, string> = { '스피킹': 'speaking', '리딩': 'reading', '보카': 'vocabulary', '라이팅': 'writing', '파닉스': 'phonics', '액티비티': 'activity' }

async function getBookerName(bookingId: string): Promise<string | null> {
  const { data: o } = await supabase.from('bookings').select('booker_name').eq('id', bookingId).maybeSingle()
  return o?.booker_name || null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')
  if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

  const { data: requests } = await supabase.from('tutor_requests').select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })

  const reqList = requests ?? []

  // confirmed 요청에 연결된 tutor_lessons 상세 조회
  const confirmedIds = reqList
    .filter((r: any) => r.status === 'confirmed')
    .map((r: any) => r.id)

  const lessonMap: Record<string, any> = {}
  for (const rid of confirmedIds) {
    const { data: lesson } = await supabase
      .from('tutor_lessons')
      .select('id, tutor_name, total_sessions, total_amount, confirmed_time, class_days, start_date, end_date')
      .ilike('admin_memo', `%request_id: ${rid}%`)
      .maybeSingle()
    if (lesson) lessonMap[rid] = lesson
  }

  // confirmed 요청별 lesson session notes 수집 (각 lesson_id로 조회)
  const notesMap: Record<string, Array<{ date: string; note: string; status: string }>> = {}
  for (const rid of confirmedIds) {
    const lesson = lessonMap[rid]
    if (!lesson?.id) continue
    const { data: sessions } = await supabase
      .from('tutor_lesson_sessions')
      .select('session_date, session_note, status')
      .eq('lesson_id', lesson.id)
      .not('session_note', 'is', null)
      .neq('session_note', '')
      .order('session_date', { ascending: true })
    if (sessions && sessions.length > 0) {
      notesMap[rid] = sessions.map((s: any) => ({
        date: s.session_date,
        note: s.session_note,
        status: s.status,
      }))
    }
  }

  return NextResponse.json({ requests: reqList, lessonMap, notesMap })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { booking_id, guest_name } = body
    if (!booking_id) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

    // 필수 동의 체크
    if ((!body.privacy_agreed && !body.agreed_to_privacy) || (!body.rules_agreed && !body.agreed_to_policy)) {
      return NextResponse.json({ error: '개인정보 동의와 튜터 규정 동의는 필수입니다.' }, { status: 400 })
    }

    // 예약자명: 실제 booking.booker_name 우선, 포털 guest_name(=로그인 ID) 폴백
    const bookerName = (await getBookerName(booking_id)) || guest_name || '손님'

    const row: Record<string, unknown> = {
      booking_id,
      guest_name: bookerName,
      house_number: bookerName,
      student_name_kr: body.student_name_kr || null,
      student_name_en: body.student_name_en || null,
      student_age: body.student_age || null,
      student2_age: body.student2_age || null,
      class_type: body.class_type || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      preferred_days: Array.isArray(body.preferred_days_arr) ? body.preferred_days_arr.join(',') : (body.preferred_days_arr || null),
      skip_dates: Array.isArray(body.skip_dates) ? body.skip_dates : (typeof body.skip_dates === 'string' && body.skip_dates ? [body.skip_dates] : []),
      change_notes: body.change_notes || null,
      preferred_time: body.preferred_time || null,
      sessions_per_day: typeof body.sessions_per_day === 'number' ? body.sessions_per_day : null,
      schedule_blocks: Array.isArray(body.schedule_blocks) ? body.schedule_blocks : null,
      total_sessions: typeof body.total_sessions === 'number' ? body.total_sessions : null,
      total_amount: typeof body.total_amount === 'number' ? body.total_amount : null,
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
      slot_label: body.slot_label || null,
    }

    const { data, error } = await supabase.from('tutor_requests').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
