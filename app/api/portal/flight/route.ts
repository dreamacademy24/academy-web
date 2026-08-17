import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendTelegram, escapeHtml, localTimeLine } from '@/lib/telegram'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

async function loadBooking(bookingId: string) {
  const { data: oldB } = await supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle()
  if (oldB) return { booking: oldB, source: 'old' as const }
  return null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('booking_id')
  if (!bookingId) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

  const result = await loadBooking(bookingId)
  if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const b = result.booking
  const checkIn = b.check_in || b.checkin_date
  const daysLeft = daysUntil(checkIn)

  return NextResponse.json({
    source: result.source,
    check_in: checkIn,
    days_left: daysLeft,
    locked: daysLeft !== null && daysLeft < 7,
    flight_in: {
      airline: b.flight_in_airline || b.flight_in || '',
      date: b.flight_in_date || '',
      time: b.flight_in_time || '',
    },
    flight_out: {
      airline: b.flight_out_airline || b.flight_out || '',
      date: b.flight_out_date || '',
      time: b.flight_out_time || '',
    },
    booker_name: b.booker_name,
  })
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { booking_id, ...fields } = body
    if (!booking_id) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

    const result = await loadBooking(booking_id)
    if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const checkIn = result.booking.check_in || result.booking.checkin_date
    const daysLeft = daysUntil(checkIn)
    if (daysLeft !== null && daysLeft < 7) {
      return NextResponse.json({ error: '체크인 7일 전부터는 수정할 수 없습니다. 관리자에게 문의하세요.' }, { status: 403 })
    }

    const allowed = ['flight_in_airline','flight_in_no','flight_in_date','flight_in_time','flight_in_origin','flight_in_undecided','flight_out_airline','flight_out_no','flight_out_date','flight_out_time','flight_out_destination','flight_out_undecided']
    const update: Record<string, unknown> = {}
    for (const k of allowed) if (k in fields) update[k] = (fields as Record<string, unknown>)[k] === '' ? null : (fields as Record<string, unknown>)[k]
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'no fields to update' }, { status: 400 })

    const { error } = await supabase.from('bookings').update(update).eq('id', booking_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const today = new Date().toISOString().slice(0, 10)
    const bookerName = result.booking.booker_name || '손님'
    const f = fields as Record<string, string>
    await supabase.from('staff_tasks').insert({
      title: `✈️ ${bookerName}님이 항공편을 등록/변경했습니다`,
      assignee: 'all', due: today, done: false, shared: true,
      note: `예약 ID: ${booking_id}\n체크인: ${checkIn || '-'}\n입국: ${f.flight_in_airline || ''} ${f.flight_in_no || ''} ${f.flight_in_date || ''} ${f.flight_in_time || ''}\n출국: ${f.flight_out_airline || ''} ${f.flight_out_no || ''} ${f.flight_out_date || ''} ${f.flight_out_time || ''}`,
    })
    try {
      await supabase.from('customer_activity').insert({
        type: 'flight', action: '등록',
        title: `항공편 등록/변경${checkIn ? ` · 체크인 ${checkIn}` : ''}`,
        reserver: bookerName, booking_id, ref_table: 'bookings',
      })
    } catch { /* noop */ }

    // 텔레그램 그룹 알림 (best-effort)
    {
      const inLine = [f.flight_in_airline, f.flight_in_no, f.flight_in_date, f.flight_in_time].filter(Boolean).join(' ')
      const outLine = [f.flight_out_airline, f.flight_out_no, f.flight_out_date, f.flight_out_time].filter(Boolean).join(' ')
      const lines = [`🔔 <b>항공권 등록/수정</b>`, `예약자: ${escapeHtml(bookerName)}`]
      if (inLine) lines.push(`입국: ${escapeHtml(inLine)}`)
      if (outLine) lines.push(`출국: ${escapeHtml(outLine)}`)
      const tl = localTimeLine(); if (tl) lines.push(tl)
      await sendTelegram(lines.join('\n'))
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { booking_id, flight_in, flight_out } = body
    if (!booking_id) return NextResponse.json({ error: 'booking_id required' }, { status: 400 })

    const result = await loadBooking(booking_id)
    if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const checkIn = result.booking.check_in || result.booking.checkin_date
    const daysLeft = daysUntil(checkIn)
    if (daysLeft !== null && daysLeft < 7) {
      return NextResponse.json({ error: '체크인 7일 전부터는 수정할 수 없습니다. 관리자에게 문의하세요.' }, { status: 403 })
    }

    const bookerName = result.booking.booker_name || '손님'

    {
      const fIn = [flight_in?.airline, flight_in?.date, flight_in?.time].filter(Boolean).join(' ')
      const fOut = [flight_out?.airline, flight_out?.date, flight_out?.time].filter(Boolean).join(' ')
      const { error } = await supabase.from('bookings').update({
        flight_in: fIn || null,
        flight_out: fOut || null,
      }).eq('id', booking_id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 어드민 알림 태스크
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('staff_tasks').insert({
      title: `✈️ ${bookerName}님이 항공편을 등록/변경했습니다`,
      assignee: 'all',
      due: today,
      done: false,
      shared: true,
      note: `예약 ID: ${booking_id}\n체크인: ${checkIn || '-'}\n입국: ${flight_in?.airline || ''} ${flight_in?.date || ''} ${flight_in?.time || ''}\n출국: ${flight_out?.airline || ''} ${flight_out?.date || ''} ${flight_out?.time || ''}`,
    })
    try {
      await supabase.from('customer_activity').insert({
        type: 'flight', action: '등록',
        title: `항공편 등록/변경${checkIn ? ` · 체크인 ${checkIn}` : ''}`,
        reserver: bookerName, booking_id, ref_table: 'bookings',
      })
    } catch { /* noop */ }

    // 텔레그램 그룹 알림 (best-effort)
    {
      const inLine = [flight_in?.airline, flight_in?.date, flight_in?.time].filter(Boolean).join(' ')
      const outLine = [flight_out?.airline, flight_out?.date, flight_out?.time].filter(Boolean).join(' ')
      const lines = [`🔔 <b>항공권 등록/수정</b>`, `예약자: ${escapeHtml(bookerName)}`]
      if (inLine) lines.push(`입국: ${escapeHtml(inLine)}`)
      if (outLine) lines.push(`출국: ${escapeHtml(outLine)}`)
      const tl = localTimeLine(); if (tl) lines.push(tl)
      await sendTelegram(lines.join('\n'))
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
