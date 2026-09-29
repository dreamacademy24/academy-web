import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { currentHr } from '@/lib/hrServer'
import { currentEmployee } from '@/lib/hrEmployeeSession'

export const dynamic = 'force-dynamic'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// 본인 비밀번호 변경 — POST { current, next }
export async function POST(req: Request) {
  const s = await currentHr(req) || await currentEmployee(req)
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const { current, next } = await req.json().catch(() => ({}))
  if (!current || !next || String(next).length < 6) return NextResponse.json({ error: '새 비밀번호는 6자 이상으로 입력하세요.' }, { status: 400 })
  const { data } = await db.rpc('verify_hr_login', { p_username: s.username, p_password: String(current) })
  if (!(Array.isArray(data) ? data[0] : data)) return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 400 })
  const esc = (v: string) => "'" + v.replace(/'/g, "''") + "'"
  const { error } = await db.rpc('exec_sql', { sql: `UPDATE hr_accounts SET password_hash = crypt(${esc(String(next))}, gen_salt('bf')), must_change_pw = false WHERE username = ${esc(s.username)}` })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
