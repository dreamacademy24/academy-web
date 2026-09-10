import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireBooking } from '@/lib/portalAuth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { subscription, booking_id, user_agent } = await req.json()
    const denied = await requireBooking(req, booking_id)
    if (denied) return denied

    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'subscription.endpoint required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          booking_id: booking_id ?? null,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys?.p256dh,
          auth: subscription.keys?.auth,
          user_agent: user_agent ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unknown error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const { subscription, booking_id } = await req.json();
  const denied = await requireBooking(req, booking_id);
  if (denied) return denied;
  if (!subscription?.endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint).eq('booking_id', booking_id);
  return NextResponse.json(error ? { error: '알림 연결 해제에 실패했습니다.' } : { ok: true }, { status: error ? 500 : 200 });
}
