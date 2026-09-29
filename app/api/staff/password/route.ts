import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getStaffIdentity } from '@/lib/portalAuth'

export const dynamic = 'force-dynamic'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const q = (v: string) => "'" + String(v).replace(/'/g, "''") + "'"

// 직원 본인 비밀번호 — 로그인 쿠키(서명)로 본인 확인 후 DB(staff_accounts)에 저장.
// (예전 직원업무 화면은 브라우저 localStorage에만 저장해서 실제 로그인 비번이 안 바뀌던 문제 해결)

// GET → { username, name, must_change }
export async function GET(req: Request) {
  const me = await getStaffIdentity(req).catch(() => null)
  if (!me) return NextResponse.json({ error: 'not signed in' }, { status: 401 })
  let must = false
  try {
    const { data } = await db.from('staff_accounts').select('must_change_pw').eq('username', me.username).maybeSingle()
    must = !!(data as { must_change_pw?: boolean } | null)?.must_change_pw
  } catch { /* 컬럼 없으면 false */ }
  return NextResponse.json({ username: me.username, name: me.name, must_change: must })
}

// POST { current, next } → 본인 비번 변경
export async function POST(req: Request) {
  const me = await getStaffIdentity(req).catch(() => null)
  if (!me) return NextResponse.json({ error: 'Please sign in again. / 다시 로그인해 주세요.' }, { status: 401 })
  const { current, next } = await req.json().catch(() => ({}))
  if (!current || !next) return NextResponse.json({ error: 'Enter current and new password. / 현재·새 비밀번호를 입력하세요.' }, { status: 400 })
  if (String(next).length < 4) return NextResponse.json({ error: 'New password must be at least 4 characters. / 새 비밀번호는 4자 이상' }, { status: 400 })
  const { data: ok } = await db.rpc('verify_teacher_login', { p_username: me.username, p_password: String(current) })
  if (!(Array.isArray(ok) ? ok[0] : ok)) return NextResponse.json({ error: 'Current password is incorrect. / 현재 비밀번호가 틀렸습니다.' }, { status: 400 })
  const { error } = await db.rpc('exec_sql', { sql: `UPDATE staff_accounts SET password_hash = crypt(${q(next)}, gen_salt('bf')) WHERE username = ${q(me.username)}` })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await db.rpc('exec_sql', { sql: `UPDATE staff_accounts SET must_change_pw = false WHERE username = ${q(me.username)}` }).then(() => {}, () => {})
  // 저장 확인: 새 비번으로 실제 로그인되는지 검증
  const { data: chk } = await db.rpc('verify_teacher_login', { p_username: me.username, p_password: String(next) })
  if (!(Array.isArray(chk) ? chk[0] : chk)) return NextResponse.json({ error: 'Save could not be verified. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
