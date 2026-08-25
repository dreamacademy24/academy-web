import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 화상영어 당일 아침 알림 — 매일 KST 09:00 (Vercel Cron, UTC 00:00)
// 오늘 예정(scheduled) 세션이 있는 포털 공개(portal_open) 수강생의 손님 계정에 웹푸시 발송

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const toUrlSafe = (k: string) => k.trim().replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
let vapidReady = false
function ensureVapid(): boolean {
  if (vapidReady) return true
  const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const PRIV = process.env.VAPID_PRIVATE_KEY
  if (!PUB || !PRIV) return false
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@dreamacademyph.com', toUrlSafe(PUB), toUrlSafe(PRIV))
    vapidReady = true
    return true
  } catch { return false }
}

function kstToday(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!ensureVapid()) return NextResponse.json({ error: 'VAPID not configured' }, { status: 500 })

  const today = kstToday()

  // 1) 오늘 예정 세션 + 수강권(포털 공개 + 계정 연결) 조회
  const { data: sessions, error } = await supabase
    .from('online_sessions')
    .select('id, scheduled_date, scheduled_time_kr, enrollment:online_enrollments(id, student_name, customer_user_id, portal_open, class_time_kr, status)')
    .eq('scheduled_date', today)
    .eq('status', 'scheduled')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Enr = { id: string; student_name: string; customer_user_id: string | null; portal_open: boolean | null; class_time_kr: string | null; status: string }
  const targets: Array<{ userId: string; student: string; time: string }> = []
  for (const s of sessions || []) {
    const e = (Array.isArray(s.enrollment) ? s.enrollment[0] : s.enrollment) as Enr | null
    if (!e || e.portal_open !== true || !e.customer_user_id || e.status !== 'active') continue
    targets.push({
      userId: e.customer_user_id,
      student: e.student_name || '',
      time: (s as { scheduled_time_kr?: string | null }).scheduled_time_kr || e.class_time_kr || '',
    })
  }
  if (targets.length === 0) return NextResponse.json({ ok: true, sent: 0, note: 'no sessions today' })

  // 2) 계정 → 예약(booking) 매핑 (push_subscriptions는 booking_id 기준)
  const userIds = [...new Set(targets.map(t => t.userId))]
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, portal_user_id')
    .in('portal_user_id', userIds)
  const userToBookings = new Map<string, string[]>()
  for (const b of bookings || []) {
    const uid = (b as { portal_user_id?: string }).portal_user_id
    if (!uid) continue
    if (!userToBookings.has(uid)) userToBookings.set(uid, [])
    userToBookings.get(uid)!.push((b as { id: string }).id)
  }

  let sent = 0, failed = 0, noSub = 0
  for (const uid of userIds) {
    const userTargets = targets.filter(t => t.userId === uid)
    const bids = userToBookings.get(uid) || []
    if (bids.length === 0) { noSub++; continue }
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('booking_id', bids)
    if (!subs || subs.length === 0) { noSub++; continue }

    const lines = userTargets.map(t => `${t.student}${t.time ? ` · ${t.time} (한국시간)` : ''}`)
    const payload = JSON.stringify({
      title: '💻 오늘 화상영어 수업이 있어요',
      body: lines.join('\n'),
      url: '/portal/online-class',
    })
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent++
      } catch {
        failed++
      }
    }
  }

  return NextResponse.json({ ok: true, date: today, sessions: targets.length, sent, failed, no_subscription: noSub })
}
