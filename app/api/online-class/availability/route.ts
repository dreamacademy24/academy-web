import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DAY_NORMALIZE: Record<string, string> = {
  mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri', sat: 'sat', sun: 'sun',
  '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', '금': 'fri', '토': 'sat', '일': 'sun',
}
function normDay(d: string): string { return DAY_NORMALIZE[d.toLowerCase()] || DAY_NORMALIZE[d] || d.toLowerCase() }

function normTime(t: string | null): string | null {
  if (!t) return null
  const m = t.match(/(\d{1,2})[:시](\d{2})/)
  if (!m) return t
  return `${m[1].padStart(2,'0')}:${m[2]}`
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const days = searchParams.getAll('days').concat(searchParams.getAll('days[]'))
  const daysCsv = searchParams.get('days')
  const time = searchParams.get('time')

  const reqDays = (days.length ? days : (daysCsv ? daysCsv.split(',') : []))
    .map(normDay).filter(Boolean)

  if (!reqDays.length || !time) {
    return NextResponse.json({ error: 'days and time required' }, { status: 400 })
  }
  const reqTime = normTime(time)

  const { data: tutors, error: tErr } = await supabase
    .from('online_tutors')
    .select('id, name_display, name_en')
    .eq('is_active', true)
    .order('name_display')
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })

  const { data: enrolls, error: eErr } = await supabase
    .from('online_enrollments')
    .select('tutor_id, days_of_week, class_time_kr, status')
    .eq('status', 'active')
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

  const result = (tutors || []).map(t => {
    const conflicts = (enrolls || []).filter(e => {
      if (e.tutor_id !== t.id) return false
      if (normTime(e.class_time_kr) !== reqTime) return false
      const tutorDays = (e.days_of_week || []).map(normDay)
      return reqDays.some(d => tutorDays.includes(d))
    })
    return {
      id: t.id,
      name: t.name_display,
      name_en: t.name_en,
      available: conflicts.length === 0,
      reason: conflicts.length
        ? `${reqDays.filter(d => conflicts.some(c => (c.days_of_week || []).map(normDay).includes(d))).join('/').toUpperCase()} ${reqTime} occupied`
        : null,
    }
  })

  const availables = result.filter(r => r.available)
  return NextResponse.json({
    time: reqTime,
    days: reqDays,
    tutors: result,
    any_available: availables.length > 0,
    suggested_tutor: availables[0] ? { id: availables[0].id, name: availables[0].name } : null,
    message: availables.length > 0 ? null : '해당 시간대는 마감되었습니다.',
  })
}
