import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const KEYS: Record<string, string> = { confirm: 'oc_confirmed_enrollments', close: 'oc_closed_enrollments' }

export async function GET() {
  const out: Record<string, string[]> = {}
  for (const [kind, key] of Object.entries(KEYS)) {
    const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle()
    out[kind] = Array.isArray(data?.value) ? data!.value : []
  }
  return NextResponse.json({ ids: out.confirm, confirm: out.confirm, close: out.close })
}

// POST { id, on, kind?: 'confirm'|'close' }
export async function POST(req: Request) {
  const { id, on, kind = 'confirm' } = await req.json()
  const key = KEYS[kind]
  if (!id || !key) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle()
  let list: string[] = Array.isArray(data?.value) ? data!.value : []
  if (on) { if (!list.includes(id)) list.push(id) } else list = list.filter(x => x !== id)
  const { error } = await supabase.from('app_settings').upsert({ key, value: list }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, ids: list })
}
