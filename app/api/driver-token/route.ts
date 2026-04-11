import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { driver_id } = await req.json()
  if (!driver_id) return NextResponse.json({ error: 'driver_id required' }, { status: 400 })

  // 기존 토큰 확인
  const { data: existing } = await supabase
    .from('drivers')
    .select('share_token')
    .eq('id', driver_id)
    .single()

  if (existing?.share_token) {
    return NextResponse.json({ token: existing.share_token })
  }

  // 새 토큰 생성
  const token = randomBytes(16).toString('hex')
  const { error } = await supabase
    .from('drivers')
    .update({ share_token: token })
    .eq('id', driver_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token })
}
