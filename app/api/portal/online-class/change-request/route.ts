import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 엄마 포털: 변경 요청 생성 + 본인 요청 조회
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const customerUserId = searchParams.get('customer_user_id')
  const enrollmentId = searchParams.get('enrollment_id')
  if (!customerUserId && !enrollmentId) return NextResponse.json({ requests: [] })

  let q = supabase.from('online_change_requests').select('*').order('created_at', { ascending: false })
  if (customerUserId) q = q.eq('customer_user_id', customerUserId)
  if (enrollmentId) q = q.eq('enrollment_id', enrollmentId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data ?? [] })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { enrollment_id, customer_user_id, req_days_of_week, req_time_kr, effective_from, memo } = body
    if (!enrollment_id) return NextResponse.json({ error: 'enrollment_id required' }, { status: 400 })
    if (!customer_user_id) return NextResponse.json({ error: 'customer_user_id required' }, { status: 400 })
    if (!effective_from) return NextResponse.json({ error: '적용 시작일을 선택해주세요.' }, { status: 400 })
    if (!(req_days_of_week?.length) && !req_time_kr) {
      return NextResponse.json({ error: '변경할 요일 또는 시간을 입력해주세요.' }, { status: 400 })
    }

    // 본인 확인
    const { data: enroll } = await supabase
      .from('online_enrollments')
      .select('id, customer_user_id, student_name')
      .eq('id', enrollment_id)
      .single()
    if (!enroll) return NextResponse.json({ error: 'enrollment not found' }, { status: 404 })
    if (enroll.customer_user_id !== customer_user_id) {
      return NextResponse.json({ error: '본인 수강 정보만 변경 요청할 수 있습니다.' }, { status: 403 })
    }

    // 4일 전 규칙
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const eff = new Date(effective_from + 'T00:00:00')
    const daysBefore = Math.round((eff.getTime() - today.getTime()) / 86400000)
    if (daysBefore < 4) {
      return NextResponse.json({ error: '변경은 적용일 4일 전까지만 신청 가능합니다. 급한 변경은 카카오톡으로 문의해주세요.' }, { status: 400 })
    }

    // 중복 pending 방지
    const { data: dup } = await supabase
      .from('online_change_requests')
      .select('id')
      .eq('enrollment_id', enrollment_id)
      .eq('status', 'pending')
      .limit(1)
    if (dup && dup.length > 0) {
      return NextResponse.json({ error: '이미 검토 중인 변경 요청이 있습니다. 처리 후 다시 신청해주세요.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('online_change_requests')
      .insert({
        enrollment_id, customer_user_id,
        req_days_of_week: req_days_of_week?.length ? req_days_of_week : null,
        req_time_kr: req_time_kr || null,
        effective_from, memo: memo || null,
        status: 'pending',
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, request: data })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
