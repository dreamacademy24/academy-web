import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 손님 포털: 학생 영문 이름 등록 (students 테이블 + bookings.students JSONB 동시 갱신)
export async function POST(req: Request) {
  try {
    const { booking_id, student_id, name_kr, name_en } = await req.json()
    if (!booking_id || !name_en?.trim()) {
      return NextResponse.json({ error: 'booking_id, name_en required' }, { status: 400 })
    }
    const en = String(name_en).trim()

    // 1) students 테이블
    if (student_id) {
      await supabase.from('students').update({ name_en: en }).eq('id', student_id).eq('booking_id', booking_id)
    } else if (name_kr) {
      await supabase.from('students').update({ name_en: en }).eq('booking_id', booking_id).eq('name_kr', name_kr)
    }

    // 2) bookings.students JSONB (camelCase 호환)
    const { data: bk } = await supabase.from('bookings').select('students').eq('id', booking_id).maybeSingle()
    if (bk) {
      let arr: Array<Record<string, unknown>> = []
      try { arr = typeof bk.students === 'string' ? JSON.parse(bk.students) : (Array.isArray(bk.students) ? bk.students : []) } catch { arr = [] }
      if (Array.isArray(arr) && arr.length > 0) {
        const patched = arr.map(s => {
          const kr = String(s.korName ?? s.name_kr ?? '')
          if (name_kr && kr === name_kr) return { ...s, engName: en, name_en: en }
          return s
        })
        await supabase.from('bookings').update({ students: patched }).eq('id', booking_id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
