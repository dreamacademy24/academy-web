import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, name, phone, email, address, children, created_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data || [] })
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
