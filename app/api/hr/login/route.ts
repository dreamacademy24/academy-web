import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { signHr } from '@/lib/hrAuth'
import { hrAccess } from '@/lib/hrAccess'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST { username, password } → { ok, token, user }
export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}))
  if (!username || !password) return NextResponse.json({ error: '아이디와 비밀번호를 입력하세요.' }, { status: 400 })

  const { data, error } = await supabase.rpc('verify_hr_login', {
    p_username: ((u: string) => (u === 'ceo' ? 'may' : u))(String(username).trim().toLowerCase().replace(/^admin-/, '')), // admin- 붙여도/안 붙여도 OK, ceo=may
    p_password: String(password),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const user = Array.isArray(data) ? data[0] : data
  if (!user) return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })

  const access = hrAccess(user.username, user.role, user.companies)
  if (!access.companies.length) return NextResponse.json({ error: 'HR access is not assigned to this account. / HR 접근 권한이 없습니다.' }, { status: 403 })
  const token = signHr({
    username: user.username,
    role: user.role === 'employee' ? 'employee' : 'admin',
    name: user.name,
    employee_id: user.employee_id ?? null,
    companies: access.companies,
  })
  return NextResponse.json({
    ok: true,
    token,
    user: { username: user.username, role: user.role, name: user.name, employee_id: user.employee_id ?? null, companies: access.companies, must_change_pw: !!user.must_change_pw, language: access.language, full: access.full },
  })
}
