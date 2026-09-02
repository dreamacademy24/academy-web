import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const keyOf = (id: string) => `oc_comments_${id}`
type C = { id: string; by: string; at: string; text: string }

async function list(enrId: string): Promise<C[]> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', keyOf(enrId)).maybeSingle()
  return Array.isArray(data?.value) ? data!.value : []
}

export async function GET(req: Request) {
  const enrId = new URL(req.url).searchParams.get('enrollment_id')
  if (!enrId) return NextResponse.json({ error: 'enrollment_id required' }, { status: 400 })
  return NextResponse.json({ comments: await list(enrId) })
}

// POST { enrollment_id, by, text }  |  { enrollment_id, delete_id }
export async function POST(req: Request) {
  const { enrollment_id, by, text, delete_id } = await req.json()
  if (!enrollment_id) return NextResponse.json({ error: 'enrollment_id required' }, { status: 400 })
  let arr = await list(enrollment_id)
  if (delete_id) arr = arr.filter(c => c.id !== delete_id)
  else {
    if (!text || !String(text).trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })
    arr.push({ id: String(Date.now()), by: String(by || '관리자'), at: new Date().toISOString(), text: String(text).trim() })
  }
  const { error } = await supabase.from('app_settings').upsert({ key: keyOf(enrollment_id), value: arr }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, comments: arr })
}
