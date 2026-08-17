'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DH_ROOMS, normRoom } from '@/lib/dhRooms'
import { isAdminAuthed } from '@/lib/adminAuth'

const TOTAL = DH_ROOMS.length
const DH_SET = new Set(DH_ROOMS.map(normRoom))
const ds = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const isDH = (t?: string) => /드림하우스|dreamhouse|드하/i.test(t || '')

type Wk = { week: string; free: number }

export default function RoomAvailability() {
  const router = useRouter()
  const [rows, setRows] = useState<Wk[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState('')

  useEffect(() => {
    if (!isAdminAuthed()) { router.replace('/login'); return }
    load()
  }, [])

  async function load() {
    setLoading(true)
    const today = ds(new Date())
    const { data } = await supabase.from('bookings')
      .select('accom_type,booking_type,checkin_date,checkout_date,house_no,accom_room,seg1_type,seg1_checkin,seg1_checkout,seg2_type,seg2_checkin,seg2_checkout,status')
      .gte('checkout_date', today)
    const act = (data || []).filter((b: any) => !/cancel|취소/i.test(b.status || ''))
    const occ: { room: string; ci: string; co: string }[] = []
    act.forEach((b: any) => {
      const room = normRoom(b.house_no || b.accom_room)
      const segs: [string, string][] = []
      if (b.seg1_type && isDH(b.seg1_type) && b.seg1_checkin && b.seg1_checkout) segs.push([b.seg1_checkin, b.seg1_checkout])
      if (b.seg2_type && isDH(b.seg2_type) && b.seg2_checkin && b.seg2_checkout) segs.push([b.seg2_checkin, b.seg2_checkout])
      if (segs.length) segs.forEach(s => occ.push({ room, ci: s[0], co: s[1] }))
      else if (isDH(b.accom_type) || /dreamhouse/i.test(b.booking_type || '')) { if (b.checkin_date && b.checkout_date) occ.push({ room, ci: b.checkin_date, co: b.checkout_date }) }
    })
    const start = new Date(); const day = start.getDay(); start.setDate(start.getDate() + (day === 1 ? 0 : (8 - day) % 7))
    const wk: Wk[] = []
    for (let i = 0; i < 27; i++) {
      const m = new Date(start); m.setDate(m.getDate() + i * 7)
      const we = new Date(m); we.setDate(we.getDate() + 7)
      const mS = ds(m), weS = ds(we)
      const busy = new Set<string>()
      occ.forEach(o => { if (o.ci && o.co && o.ci < weS && o.co > mS && DH_SET.has(o.room)) busy.add(o.room) })
      wk.push({ week: mS, free: TOTAL - busy.size })
    }
    setRows(wk); setUpdatedAt(new Date().toLocaleString('ko-KR')); setLoading(false)
  }

  const firstFree = rows.find(r => r.free >= 1)
  const status = (f: number) => f <= 0 ? { t: '마감', c: '#dc2626', bg: '#fef2f2' } : f <= 2 ? { t: `임박 · ${f}룸`, c: '#c2410c', bg: '#fff7ed' } : { t: `여유 · ${f}룸`, c: '#15803d', bg: '#f0fdf4' }
  const fmt = (w: string) => { const p = w.split('-'); return `${p[1]}/${p[2]}` }
  const months: { key: string; label: string; weeks: Wk[] }[] = []
  rows.forEach(r => {
    const key = r.week.slice(0, 7); const [y, mo] = key.split('-')
    let g = months.find(x => x.key === key); if (!g) { g = { key, label: `${y}년 ${Number(mo)}월`, weeks: [] }; months.push(g) }
    g.weeks.push(r)
  })

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>🛏 잔여 객실 현황</h1>
        <button onClick={load} style={{ padding: '7px 14px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>🔄 새로고침</button>
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>드림하우스 독채 {TOTAL}룸 실시간 · 예약 DB 기준{updatedAt ? ` · ${updatedAt} 갱신` : ''}</div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: '1 1 240px', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', background: '#f8fafc' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>드림하우스 가장 빠른 입실 가능</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f766e' }}>{loading ? '…' : firstFree ? `${fmt(firstFree.week)} 주 (${firstFree.free}룸)` : '가까운 주 만실'}</div>
        </div>
        <div style={{ flex: '1 1 240px', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', background: '#f8fafc' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>제이파크 · 큐브나인 (리조트)</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f766e' }}>여유 충분</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>원하는 주 대부분 가능 · 정확 잔여는 리조트 컨펌</div>
        </div>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>불러오는 중…</div> :
        months.map(mth => (
          <div key={mth.key} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', margin: '0 0 8px' }}>{mth.label}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
              {mth.weeks.map(w => { const s = status(w.free); return (
                <div key={w.week} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', background: s.bg }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{fmt(w.week)} 주</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.c, marginTop: 2 }}>{s.t}</div>
                </div>
              ) })}
            </div>
          </div>
        ))}

      <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
        · 개강은 매주 월요일 / 성수기(~8월 말, 12~2월)는 3주 이상 등록<br />
        · 드림하우스는 예약 상황에 따라 실시간 변동됩니다
      </div>
      <div style={{ marginTop: 20 }}><a href="/admin/hub" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>← 관리자 홈</a></div>
    </div>
  )
}
