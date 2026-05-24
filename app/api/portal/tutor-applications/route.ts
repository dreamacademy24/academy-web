import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')
  if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

  const { data: apps, error } = await supabase
    .from('tutor_applications')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tutorIds = Array.from(
    new Set(
      (apps ?? [])
        .filter(a => a.status === 'confirmed' && a.assigned_tutor_id)
        .map(a => a.assigned_tutor_id as string)
    )
  )

  let tutorMap: Record<string, string> = {}
  if (tutorIds.length > 0) {
    const { data: tutors } = await supabase
      .from('tutors')
      .select('id, name')
      .in('id', tutorIds)
    if (tutors) {
      for (const t of tutors) tutorMap[t.id] = t.name
    }
  }

  const applications = (apps ?? []).map(a => ({
    ...a,
    assigned_tutor_name: a.assigned_tutor_id ? (tutorMap[a.assigned_tutor_id] || null) : null,
  }))

  return NextResponse.json({ applications })
}
