import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const KEY = 'oc_confirmed_enrollments'

export async function GET() {
  const { data } = await supabase.from('app_settings').select('value').eq('key', KEY).maybeSingle()
  return NextResponse.json({ ids: Array.isArray(data?.value) ? data!.value : [] })
}

// POST { id, on }
export async function POST(req: Request) {
  const { id, on } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data } = await supabase.from('app_settings').select('value').eq('key', KEY).maybeSingle()
  let list: string[] = Array.isArray(data?.value) ? data!.value : []
  if (on) { if (!list.includes(id)) list.push(id) } else list = list.filter(x => x !== id)
  const { error } = await supabase.from('app_settings').upsert({ key: KEY, value: list }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, ids: list })
}
