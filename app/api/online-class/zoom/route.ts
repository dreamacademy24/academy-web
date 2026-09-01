import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const KEY = 'oc_tutor_zoom_links' // { [tutor_id]: "줌 링크 블록 텍스트" }

export async function GET() {
  const { data } = await supabase.from('app_settings').select('value').eq('key', KEY).maybeSingle()
  return NextResponse.json({ links: (data?.value && typeof data.value === 'object') ? data.value : {} })
}

export async function POST(req: Request) {
  const { tutor_id, text } = await req.json()
  if (!tutor_id) return NextResponse.json({ error: 'tutor_id required' }, { status: 400 })
  const { data } = await supabase.from('app_settings').select('value').eq('key', KEY).maybeSingle()
  const map: Record<string, string> = (data?.value && typeof data.value === 'object') ? data.value : {}
  map[tutor_id] = String(text || '')
  const { error } = await supabase.from('app_settings').upsert({ key: KEY, value: map }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
