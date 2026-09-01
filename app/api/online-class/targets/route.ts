import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EXCL_KEY = 'oc_targets_excluded'

// GET: 올해 다녀간(체크인 기준) 아이 전체 — 화상영어 등록 대상 목록
export async function GET() {
  const year = new Date(Date.now() + 8 * 3600 * 1000).getFullYear()
  const { data: bks, error } = await supabase.from('bookings')
    .select('id, booker_name, checkin_date, checkout_date, house_no, accom_room, accom_type, students, portal_user_id, status')
    .gte('checkin_date', `${year}-01-01`)
    .neq('status', '취소')
    .order('checkin_date')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: enr } = await supabase.from('online_enrollments')
    .select('student_name, status')
  const enrolledActive = new Set((enr || []).filter(e => e.status === 'active' || e.status === 'scheduled').map(e => (e.student_name || '').trim()))
  const enrolledEver = new Set((enr || []).map(e => (e.student_name || '').trim()))

  const { data: ex } = await supabase.from('app_settings').select('value').eq('key', EXCL_KEY).maybeSingle()
  const excluded: string[] = Array.isArray(ex?.value) ? ex!.value : []
  const exSet = new Set(excluded)

  const rows: any[] = []
  for (const b of (bks || [])) {
    if ((b.accom_type || '').includes('통학')) continue // 통학형 제외 (화상영어 대상 아님)
    let arr: unknown = b.students
    if (typeof arr === 'string') { try { arr = JSON.parse(arr) } catch { arr = [] } }
    if (!Array.isArray(arr)) continue
    for (const st of arr) {
      const name = (st.korName || st.name_kr || st.name || '').trim()
      if (!name) continue
      const key = `${b.id}|${name}`
      rows.push({
        key,
        name_kr: name,
        name_en: (st.engName || st.name_en || '').trim(),
        birth: (st.birthYear || st.age || '').toString(),
        booker_name: b.booker_name,
        house: b.house_no || b.accom_room || b.accom_type || '',
        ci: b.checkin_date, co: b.checkout_date,
        portal_user_id: b.portal_user_id || null,
        enrolled: enrolledActive.has(name) ? 'active' : enrolledEver.has(name) ? 'past' : null,
        excluded: exSet.has(key),
      })
    }
  }
  return NextResponse.json({ targets: rows, excluded })
}

// POST: { action: 'exclude'|'restore', key }
export async function POST(req: Request) {
  const { action, key } = await req.json()
  if (!key || !['exclude', 'restore'].includes(action)) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  const { data: ex } = await supabase.from('app_settings').select('value').eq('key', EXCL_KEY).maybeSingle()
  let list: string[] = Array.isArray(ex?.value) ? ex!.value : []
  if (action === 'exclude') { if (!list.includes(key)) list.push(key) }
  else list = list.filter(k => k !== key)
  const { error } = await supabase.from('app_settings').upsert({ key: EXCL_KEY, value: list }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, excluded: list })
}
