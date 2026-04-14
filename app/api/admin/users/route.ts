import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const supabase = supabaseAdmin

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, phone, email, address, children, created_at')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[/api/admin/users] profiles fetch error:', error)
      return NextResponse.json({ error: error.message, hint: error.hint, code: error.code }, { status: 500 })
    }
    return NextResponse.json({ users: data || [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[/api/admin/users] GET error:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const profErr = await supabase.from('profiles').delete().eq('id', id)
  const authRes = await supabase.auth.admin.deleteUser(id)
  if (profErr.error && authRes.error) {
    return NextResponse.json({ error: 'profile: ' + profErr.error.message + ' / auth: ' + authRes.error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, profileDeleted: !profErr.error, authDeleted: !authRes.error })
}
