import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('online_tutors')
    .select('*')
    .eq('is_active', true)
    .order('name_display')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tutors: data ?? [] })
}
