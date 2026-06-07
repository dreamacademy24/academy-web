import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const PRIVATE = process.env.VAPID_PRIVATE_KEY
if (PUBLIC && PRIVATE) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@dreamacademyph.com', PUBLIC, PRIVATE)
}

// 공지 발행 시 호출 — 대상 손님 구독에 웹푸시 발송
export async function POST(req: Request) {
  try {
    if (!PUBLIC || !PRIVATE) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
    }
    const { title, body, url, audience, target_ids } = await req.json()
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

    let q = supabase.from('push_subscriptions').select('endpoint, p256dh, auth, booking_id')
    if (audience === 'selected' && Array.isArray(target_ids) && target_ids.length > 0) {
      q = q.in('booking_id', target_ids)
    }
    const { data: subs, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const payload = JSON.stringify({
      title,
      body: body || '',
      url: url || '/portal/notices',
      tag: 'portal-notice',
    })

    let sent = 0
    let removed = 0
    await Promise.all((subs || []).map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
        sent++
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          removed++
        }
      }
    }))

    return NextResponse.json({ ok: true, total: subs?.length || 0, sent, removed })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error)?.message || 'unknown' }, { status: 500 })
  }
}
