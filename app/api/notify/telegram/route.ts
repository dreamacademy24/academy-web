import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendTelegram, escapeHtml, localTimeLine } from '@/lib/telegram'

// 클라이언트에서 supabase 직접 INSERT 하는 신청(투어 셔틀 등)의 저장 성공 후 호출되는
// 알림 전용 서버 route. 텔레그램 토큰은 이 서버 코드 안에서만 사용된다.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// booking_id로 실명(booker_name) 조회 — 없으면 폴백명 사용
async function resolveBookerName(bookingId: string | undefined, fallback: string): Promise<string> {
  if (!bookingId) return fallback
  try {
    const { data: newB } = await supabase.from('bookings_new').select('booker_name').eq('id', bookingId).maybeSingle()
    if (newB?.booker_name) return newB.booker_name
    const { data: oldB } = await supabase.from('bookings').select('booker_name').eq('id', bookingId).maybeSingle()
    if (oldB?.booker_name) return oldB.booker_name
  } catch {
    /* best-effort */
  }
  return fallback
}

export async function POST(req: Request) {
  try {
    const { type, payload } = await req.json()
    const p = payload || {}

    if (type === 'shuttle') {
      const name = await resolveBookerName(p.booking_id, p.name || '손님')
      const tours: Array<{ tourName?: string; date?: string; departTime?: string; people?: number }> =
        Array.isArray(p.tours) ? p.tours : []
      const summary = tours
        .map((t) => `${t.tourName || ''}${t.date ? ` (${t.date}${t.departTime ? ` ${t.departTime}` : ''})` : ''}`.trim())
        .filter(Boolean)
        .join(', ')
      const totalPeople = tours.reduce((s, t) => s + (Number(t.people) || 0), 0)

      const lines = [`🔔 <b>투어 셔틀 신청</b>`, `예약자: ${escapeHtml(name)}`]
      if (summary) lines.push(`투어/날짜: ${escapeHtml(summary)}`)
      if (totalPeople > 0) lines.push(`인원: ${escapeHtml(totalPeople)}명`)
      const tl = localTimeLine(); if (tl) lines.push(tl)
      await sendTelegram(lines.join('\n'))
      // 직원업무 "확인해야 할 목록" 체크리스트용 활동 로그 (best-effort)
      try {
        await supabase.from('customer_activity').insert({
          type: 'shuttle', action: '신청',
          title: summary ? `${summary}${totalPeople > 0 ? ` · ${totalPeople}명` : ''}` : '투어 셔틀 신청',
          reserver: name, booking_id: p.booking_id || null,
          ref_table: 'shuttle_applications',
        })
      } catch { /* noop */ }
    }

    if (type === 'booking') {
      const lines = [`🆕 <b>신규 예약 접수${p.daon ? ' · 다온맘 공구' : ''}</b>`, `예약자: ${escapeHtml(p.name || '')}`]
      if (p.accomType) lines.push(`상품: ${escapeHtml(p.accomType)}${p.weeks ? ` ${escapeHtml(p.weeks)}주` : ''}`)
      if (p.payMethod) lines.push(`결제: ${escapeHtml(p.payMethod)}`)
      if (p.rno) lines.push(`예약번호: ${escapeHtml(p.rno)}`)
      const tl = localTimeLine(); if (tl) lines.push(tl)
      await sendTelegram(lines.join('\n'))
    }

    if (type === 'note') {
      const lines = [`📝 <b>현지직원 코멘트</b>`]
      if (p.who) lines.push(`담당/집: ${escapeHtml(p.who)}`)
      if (p.student) lines.push(`수업: ${escapeHtml(p.student)}`)
      if (p.note) lines.push(`내용: ${escapeHtml(p.note)}`)
      const tl = localTimeLine(); if (tl) lines.push(tl)
      await sendTelegram(lines.join('\n'))
    }

    // 알림은 best-effort — 항상 ok
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[notify/telegram] failed:', e)
    return NextResponse.json({ ok: true })
  }
}
