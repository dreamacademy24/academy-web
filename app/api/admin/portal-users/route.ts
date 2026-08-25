import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 어드민 — 손님 앱(포털) 계정 검색 (화상영어 수강권 연결용)
// GET ?q=이름 또는 아이디 → profiles 검색 (service_role)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  if (q.length < 2) return NextResponse.json({ users: [] })

  const like = `%${q}%`
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, name, email')
    .or(`name.ilike.${like},username.ilike.${like},email.ilike.${like}`)
    .limit(12)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    users: (data || []).map(p => ({ id: p.id, username: p.username || '', name: p.name || '', email: p.email || '' })),
  })
}
