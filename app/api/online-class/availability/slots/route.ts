import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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

function krToPh(krTime: string): string {
  const [h, m] = krTime.split(':').map(Number)
  let ph = h - 1
  if (ph < 0) ph += 24
  return `${String(ph).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

function buildTimeSlots(): { weekday: string[]; saturday: string[] } {
  // 운영시간: KR 14:00 ~ 21:30 시작 (세부 13:00~20:30, 마지막 수업 KR 21:30 = 세부 20:30)
  const wd: string[] = []
  for (let h = 14; h <= 21; h++) {
    wd.push(`${String(h).padStart(2,'0')}:00`)
    wd.push(`${String(h).padStart(2,'0')}:30`)
  }
  const sat: string[] = [] // 토요일 수업 폐지 (2026-09) — 오전 슬롯 제거
  return { weekday: wd, saturday: sat }
}

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export async function GET() {
  const { data: tutors, error: tErr } = await supabase
    .from('online_tutors')
    .select('id, name_display')
    .eq('is_active', true)
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })

  const { data: enrolls, error: eErr } = await supabase
    .from('online_enrollments')
    .select('tutor_id, days_of_week, class_time_kr, student_name, status')
    .eq('status', 'active')
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

  const total = (tutors || []).length
  const { weekday, saturday } = buildTimeSlots()
  const allTimes = Array.from(new Set([...weekday, ...saturday])).sort()

  const slots = allTimes.map(timeKr => {
    const daysObj: Record<string, { available: number; total: number; status: string; occupied: { tutor_id: string; tutor_name: string; student_name: string }[] }> = {}
    for (const wd of WEEKDAYS) {
      const isSat = wd === 'sat'
      const applies = isSat ? saturday.includes(timeKr) : weekday.includes(timeKr)
      if (!applies) {
        daysObj[wd] = { available: 0, total: 0, status: 'closed', occupied: [] }
        continue
      }
      const occupied: { tutor_id: string; tutor_name: string; student_name: string }[] = []
      for (const t of tutors || []) {
        const conflict = (enrolls || []).find(e =>
          e.tutor_id === t.id &&
          normTime(e.class_time_kr) === timeKr &&
          (e.days_of_week || []).map(normDay).includes(wd)
        )
        if (conflict) {
          occupied.push({ tutor_id: t.id, tutor_name: t.name_display, student_name: conflict.student_name })
        }
      }
      const avail = total - occupied.length
      daysObj[wd] = {
        available: avail,
        total,
        status: avail === 0 ? 'full' : avail === 1 ? 'last' : 'open',
        occupied,
      }
    }
    return { time_kr: timeKr, time_ph: krToPh(timeKr), days: daysObj }
  })

  return NextResponse.json({ slots, tutors: (tutors || []).map(t => ({ id: t.id, name: t.name_display })) })
}
