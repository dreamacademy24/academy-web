import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const PRIVATE = process.env.VAPID_PRIVATE_KEY

// 표준 base64(+,/,=)로 저장된 키도 URL-safe base64로 정규화
const toUrlSafe = (k: string) => k.trim().replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// VAPID 설정은 요청 시점에만 (모듈 로드/빌드 시 실행되면 빌드가 깨짐)
let vapidReady = false
function ensureVapid(): { ok: boolean; error?: string } {
  if (vapidReady) return { ok: true }
  if (!PUBLIC || !PRIVATE) return { ok: false, error: 'VAPID keys not configured' }
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@dreamacademyph.com', toUrlSafe(PUBLIC), toUrlSafe(PRIVATE))
    vapidReady = true
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || 'invalid VAPID keys' }
  }
}

// 푸시 도달 가능 인원 (어드민 공지 화면 표시용)
export async function GET() {
  const { count } = await supabase.from('push_subscriptions').select('id', { count: 'exact', head: true })
  return NextResponse.json({ subscribers: count ?? 0 })
}

// 공지 발행 시 호출 — 대상 손님 구독에 웹푸시 발송
// test: true → 테스트 계정(PUSH_TEST_USERNAME, 기본 ECHTST30)에만 발송
export async function POST(req: Request) {
  try {
    const v = ensureVapid()
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 500 })

    const { title, body, url, audience, target_ids, test } = await req.json()
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

    let q = supabase.from('push_subscriptions').select('endpoint, p256dh, auth, booking_id')
    if (test === true) {
      const username = process.env.PUSH_TEST_USERNAME || 'ECHTST30'
      const { data: tb } = await supabase.from('bookings').select('id').eq('portal_username', username)
      const ids = (tb || []).map(b => b.id)
      if (ids.length === 0) return NextResponse.json({ error: `테스트 계정(${username}) 예약을 찾을 수 없습니다` }, { status: 404 })
      q = q.in('booking_id', ids)
    } else if (audience === 'selected' && Array.isArray(target_ids) && target_ids.length > 0) {
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
