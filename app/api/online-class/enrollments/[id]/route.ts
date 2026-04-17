import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: enrollment, error } = await supabase
    .from('online_enrollments')
    .select('*, tutor:online_tutors(id, name_display, name_en)')
    .eq('id', id)
    .single()

  if (error || !enrollment) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { data: sessions } = await supabase
    .from('online_sessions')
    .select('*')
    .eq('enrollment_id', id)
    .order('scheduled_date')

  return NextResponse.json({ enrollment, sessions: sessions ?? [] })
}
