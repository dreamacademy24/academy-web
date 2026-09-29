import type { SupabaseClient } from '@supabase/supabase-js'

// 직원 로그인 아이디 간소화 (2026-09-29 메이): "admin-" 없이 이름만 입력해도 로그인.
// DB의 staff_accounts.username(admin-xxx)은 그대로 두고, 입력값 후보를 순서대로 검증한다.
export function staffUsernameCandidates(input: string): string[] {
  const raw = String(input || '').trim()
  const low = raw.toLowerCase()
  const out = [raw, low]
  if (!low.startsWith('admin-')) out.push('admin-' + low)
  return [...new Set(out.filter(Boolean))]
}

export async function verifyStaffLogin(db: SupabaseClient, username: string, password: string) {
  const cands = staffUsernameCandidates(username)
  // 이름으로도 로그인 (예: "may" → admin-ceo). 같은 이름이 여러 명이면 사용 안 함
  try {
    const nm = String(username || '').trim()
    if (nm && !nm.toLowerCase().startsWith('admin-')) {
      const { data } = await db.from('staff_accounts').select('username').ilike('name', nm).eq('is_active', true)
      if (data && data.length === 1 && !cands.includes(data[0].username)) cands.push(data[0].username)
    }
  } catch { /* 무시 */ }
  for (const u of cands) {
    const { data, error } = await db.rpc('verify_teacher_login', { p_username: u, p_password: password })
    if (error) return { error }
    const row = Array.isArray(data) ? data[0] : data
    if (row) return { row }
  }
  return { row: null }
}
