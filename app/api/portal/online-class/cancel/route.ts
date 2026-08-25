import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { session_id, customer_user_id, confirm, reason } = body
    if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })
    if (!customer_user_id) return NextResponse.json({ error: 'customer_user_id required' }, { status: 400 })

    // 1. session 조회
    const { data: ses, error: sesErr } = await supabase
      .from('online_sessions')
      .select('id, enrollment_id, status, scheduled_date')
      .eq('id', session_id)
      .single()
    if (sesErr || !ses) return NextResponse.json({ error: 'session not found' }, { status: 404 })

    if (ses.status !== 'scheduled') {
      return NextResponse.json({ error: '이미 처리된 수업입니다.', message_en: 'This class has already been processed.' }, { status: 400 })
    }

    // 2. enrollment 조회 + 본인 확인
    const { data: enroll } = await supabase
      .from('online_enrollments')
      .select('id, customer_user_id, used_sessions')
      .eq('id', ses.enrollment_id)
      .single()
    if (!enroll) return NextResponse.json({ error: 'enrollment not found' }, { status: 404 })
    if (enroll.customer_user_id !== customer_user_id) {
      return NextResponse.json({ error: '본인 수업만 취소할 수 있습니다.', message_en: 'You can only cancel your own classes.' }, { status: 403 })
    }

    // 3. days_before 계산
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const sched = new Date((ses.scheduled_date || '') + 'T00:00:00')
    const daysBefore = Math.round((sched.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    let info: {
      can_cancel: boolean
      deduct: boolean
      require_confirm: boolean
      message_ko: string
      message_en: string
      days_before: number
    }

    if (daysBefore >= 4) {
      info = {
        can_cancel: true,
        deduct: false,
        require_confirm: false,
        message_ko: '취소 완료되었습니다. 마지막 회차 이후 1회 자동 추가됩니다.',
        message_en: 'Cancelled successfully. One session has been added after your last class.',
        days_before: daysBefore,
      }
    } else if (daysBefore >= 1) {
      info = {
        can_cancel: true,
        deduct: true,
        require_confirm: true,
        message_ko: '⚠️ 3일 이내 취소는 회차가 차감됩니다. 취소하시겠습니까?\n(아이가 아픈 경우 등 부득이한 사정은 사유를 남겨주시면 확인 후 보강으로 처리해드릴 수 있어요)',
        message_en: '⚠️ Cancellation within 3 days will deduct 1 session. Proceed?',
        days_before: daysBefore,
      }
    } else {
      info = {
        can_cancel: true,
        deduct: true,
        require_confirm: true,
        message_ko: '❌ 당일 취소는 회차가 차감됩니다.',
        message_en: '❌ Same-day cancellation will deduct 1 session.',
        days_before: daysBefore,
      }
    }

    // 4. confirm=false: 안내만 반환
    if (!confirm) return NextResponse.json(info)

    // 5. confirm=true: 실제 취소 처리
    const targetStatus = daysBefore >= 4 ? 'makeup' : 'cancelled'
    const noticedAt = new Date().toISOString()

    const { error: updErr } = await supabase
      .from('online_sessions')
      .update({
        status: targetStatus,
        cancel_noticed_at: noticedAt,
        cancel_days_before: daysBefore,
        ...(reason ? { session_note: `[취소사유] ${String(reason).slice(0, 200)}` } : {}),
      })
      .eq('id', session_id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

    if (info.deduct) {
      await supabase
        .from('online_enrollments')
        .update({ used_sessions: (enroll.used_sessions || 0) + 1 })
        .eq('id', enroll.id)
    }

    return NextResponse.json({
      ok: true,
      cancelled: true,
      ...info,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
