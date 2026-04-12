import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const username = (body?.username || '').trim().toLowerCase()

    if (!username) {
      return NextResponse.json({ error: 'username required' }, { status: 400 })
    }
    if (username.length < 4 || username.length > 20) {
      return NextResponse.json({ available: false, reason: 'invalid' })
    }
    if (username.startsWith('admin-') || username === 'admin') {
      return NextResponse.json({ available: false, reason: 'reserved' })
    }

    // 1단계: profiles 테이블 조회
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle()

    if (profile) {
      return NextResponse.json({ available: false, reason: 'profiles' })
    }

    // 2단계: Supabase Auth 사용자 조회
    // listUsers는 page-based — 이메일로 직접 필터링
    const internalEmail = `${username}@dreamacademyph.com`
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    if (authErr) {
      console.error('listUsers error:', authErr)
      return NextResponse.json({ error: authErr.message }, { status: 500 })
    }

    const exists = (authData?.users || []).some(u => u.email === internalEmail)
    if (exists) {
      return NextResponse.json({ available: false, reason: 'auth' })
    }

    return NextResponse.json({ available: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    console.error('check-username exception:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
