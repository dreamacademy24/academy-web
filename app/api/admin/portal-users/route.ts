import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 어드민 — 손님 앱(포털) 계정 검색 (화상영어 수강권 연결용)
// GET ?q=이름/영문명/아이디 → 예약자 이름 기준으로 "앱 계정이 연결된 예약"을 찾아 계정 반환
//   손님 앱 계정은 Supabase Auth(auth.users)에 있고, 예약(bookings.portal_user_id)로 연결됨.
//   과거엔 profiles만 검색해서 대부분의 손님이 안 잡혔음 → 예약자 이름 기반으로 변경.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type Acct = { id: string; username: string; name: string; email: string }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  if (q.length < 2) return NextResponse.json({ users: [] })

  const like = `%${q}%`
  const byId = new Map<string, Acct>()

  // 1) 예약자 이름/영문명으로 예약 검색 → 연결된 계정(portal_user_id) 수집
  const { data: bookings } = await supabase
    .from('bookings')
    .select('booker_name, booker_english, portal_user_id, checkin_date, accom_type')
    .or(`booker_name.ilike.${like},booker_english.ilike.${like}`)
    .order('checkin_date', { ascending: false })
    .limit(40)

  for (const b of bookings || []) {
    const uid = b.portal_user_id
    if (!uid) continue // 앱 계정이 아직 없는 예약은 연결 불가 → 제외
    if (byId.has(uid)) continue
    const ci = b.checkin_date ? String(b.checkin_date).slice(2) : '' // YY-MM-DD
    const sub = [ci ? `예약 ${ci}` : '', b.accom_type || ''].filter(Boolean).join(' · ')
    byId.set(uid, {
      id: uid,
      name: b.booker_name || b.booker_english || '(이름 없음)',
      username: sub,
      email: '',
    })
  }

  // 2) profiles(레거시/직접가입 계정)도 함께 검색해서 병합
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, username, name, email')
    .or(`name.ilike.${like},username.ilike.${like},email.ilike.${like}`)
    .limit(12)
  for (const p of profs || []) {
    if (!p.id || byId.has(p.id)) continue
    byId.set(p.id, { id: p.id, username: p.username || '', name: p.name || '', email: p.email || '' })
  }

  // 3) 이메일/아이디 보강 (auth.users에서, 최대 12건)
  const accts = Array.from(byId.values()).slice(0, 12)
  await Promise.all(accts.map(async a => {
    if (a.email) return
    try {
      const { data } = await supabase.auth.admin.getUserById(a.id)
      const u = data?.user
      if (u) {
        a.email = u.email || ''
        if (!a.username) a.username = (u.email ? u.email.split('@')[0] : '')
      }
    } catch { /* ignore */ }
  }))

  return NextResponse.json({ users: accts })
}
