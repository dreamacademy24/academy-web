import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// password_hash 제외 — 클라이언트에 해시 노출 금지
const PUBLIC_COLS = 'id,username,role,name,is_active,created_at,color,initial,signature'

// Postgres 단일따옴표 문자열 리터럴 이스케이프 (exec_sql 인터폴레이션 시 SQL injection 방지)
function sqlStr(v: unknown): string {
  return "'" + String(v ?? '').replace(/'/g, "''") + "'"
}

// GET /api/admin/staff-accounts?role=&active=
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')
  const active = searchParams.get('active')
  let q = supabase.from('staff_accounts').select(PUBLIC_COLS).order('role').order('name')
  if (role) q = q.eq('role', role)
  if (active === 'true') q = q.eq('is_active', true)
  if (active === 'false') q = q.eq('is_active', false)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ staff: data ?? [] })
}

// POST /api/admin/staff-accounts  { username, password, role, name, color, initial }
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { username, password, role, name, color, initial } = body
    if (!username || !password || !role || !name) {
      return NextResponse.json({ error: 'username, password, role, name은 필수입니다.' }, { status: 400 })
    }
    // 중복 username → 409
    const { data: existing, error: cErr } = await supabase
      .from('staff_accounts').select('id').eq('username', username).maybeSingle()
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
    if (existing) return NextResponse.json({ error: '이미 존재하는 username입니다.' }, { status: 409 })
    // PostgREST insert는 crypt() 함수 호출 불가 → exec_sql 로 해싱 INSERT
    const sql = `INSERT INTO staff_accounts (username, password_hash, role, name, color, initial, is_active) ` +
      `VALUES (${sqlStr(username)}, crypt(${sqlStr(password)}, gen_salt('bf')), ${sqlStr(role)}, ` +
      `${sqlStr(name)}, ${sqlStr(color || '#6366f1')}, ${sqlStr(initial || '?')}, true)`
    const { error: iErr } = await supabase.rpc('exec_sql', { sql })
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, username })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}

// PATCH /api/admin/staff-accounts  { username, action, newPassword? }
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { username, action, newPassword } = body
    if (!username || !action) {
      return NextResponse.json({ error: 'username, action은 필수입니다.' }, { status: 400 })
    }
    if (action === 'deactivate' || action === 'activate') {
      const { error } = await supabase
        .from('staff_accounts')
        .update({ is_active: action === 'activate' })
        .eq('username', username)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    if (action === 'reset_password') {
      if (!newPassword) return NextResponse.json({ error: 'newPassword가 필요합니다.' }, { status: 400 })
      const sql = `UPDATE staff_accounts SET password_hash = crypt(${sqlStr(newPassword)}, gen_salt('bf')) ` +
        `WHERE username = ${sqlStr(username)}`
      const { error } = await supabase.rpc('exec_sql', { sql })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    if (action === 'profile') {
      // 본인 프로필 (색깔·이메일 서명) 업데이트 — password 등은 건드리지 않음
      const patch: Record<string, string> = {}
      if (typeof body.color === 'string' && body.color) patch.color = body.color
      if (typeof body.signature === 'string') patch.signature = body.signature
      if (Object.keys(patch).length === 0) return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 })
      const { error } = await supabase.from('staff_accounts').update(patch).eq('username', username)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: '알 수 없는 action: ' + action }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
