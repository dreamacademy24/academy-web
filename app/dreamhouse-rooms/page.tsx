'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ROOMS = [
  'b13L10','b16L19',
  'b17L4','b17L5','b17L6','b17L7','b17L8','b17L9',
  'b17L10','b17L11','b17L12','b17L13','b17L14','b17L15','b17L16'
]

const ROOM_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316',
  '#eab308','#22c55e','#10b981','#14b8a6','#06b6d4',
  '#3b82f6','#6366f1','#a855f7','#d946ef','#f43f5e'
]

type Booking = {
  id: string
  accom_room: string
  checkin_date: string
  checkout_date: string
  checkin_time?: string
  checkout_time?: string
  guest_name?: string
  booking_number?: string
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function toDateStr(date: Date) {
  return date.toISOString().split('T')[0]
}

function parseTime(timeStr?: string): number {
  if (!timeStr) return 0
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + (m || 0)
}

export default function DreamhouseRooms() {
  const router = useRouter()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<{x:number,y:number,booking:Booking}|null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authed = localStorage.getItem('adminAuthed')
      if (!authed) router.push('/admin')
    }
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [year, month])

  async function fetchBookings() {
    setLoading(true)
    const firstDay = `${year}-${String(month+1).padStart(2,'0')}-01`
    const lastDay = `${year}-${String(month+1).padStart(2,'0')}-${getDaysInMonth(year,month)}`
    const { data } = await supabase
      .from('bookings')
      .select('id, accom_room, checkin_date, checkout_date, checkin_time, checkout_time, guest_name, booking_number')
      .lte('checkin_date', lastDay)
      .gte('checkout_date', firstDay)
      .order('checkin_date')
    setBookings(data || [])
    setLoading(false)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const dates = Array.from({length: daysInMonth}, (_,i) => {
    const d = new Date(year, month, i+1)
    return { dateStr: toDateStr(d), day: i+1, dow: d.getDay() }
  })

  // 날짜별 룸별 예약 매핑
  const cellMap: Record<string, Record<string, Booking[]>> = {}
  dates.forEach(({dateStr}) => {
    cellMap[dateStr] = {}
    ROOMS.forEach(r => { cellMap[dateStr][r] = [] })
  })
  bookings.forEach(b => {
    const cin = new Date(b.checkin_date)
    const cout = new Date(b.checkout_date)
    dates.forEach(({dateStr}) => {
      const d = new Date(dateStr)
      if (d >= cin && d < cout) {
        if (cellMap[dateStr][b.accom_room]) {
          cellMap[dateStr][b.accom_room].push(b)
        }
      }
    })
  })

  // 레이트체크아웃 + 새벽체크인 충돌 감지
  const conflictSet = new Set<string>()
  ROOMS.forEach(room => {
    const roomBookings = bookings.filter(b => b.accom_room === room)
    roomBookings.forEach(b1 => {
      roomBookings.forEach(b2 => {
        if (b1.id === b2.id) return
        if (b1.checkout_date === b2.checkin_date) {
          const outTime = parseTime(b1.checkout_time)
          const inTime = parseTime(b2.checkin_time)
          if (inTime > 0 && outTime > 0 && inTime - outTime < 120) {
            conflictSet.add(`${b1.checkout_date}_${room}`)
          }
          if (inTime > 0 && inTime < 360) {
            conflictSet.add(`${b2.checkin_date}_${room}`)
          }
        }
      })
    })
  })

  const prevMonth = () => {
    if (month === 0) { setYear(y=>y-1); setMonth(11) }
    else setMonth(m=>m-1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y=>y+1); setMonth(0) }
    else setMonth(m=>m+1)
  }

  const MONTH_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
  const DOW_KO = ['일','월','화','수','목','금','토']

  return (
    <div style={{minHeight:'100vh',background:'#0f0f1a',color:'#e2e8f0',fontFamily:'sans-serif'}}>
      {/* 헤더 */}
      <div style={{background:'linear-gradient(135deg,#1e1b4b,#312e81)',padding:'20px 24px',borderBottom:'1px solid #312e81',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <button onClick={()=>router.push('/admin')} style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#a5b4fc',padding:'8px 14px',borderRadius:8,cursor:'pointer',fontSize:13}}>← 어드민</button>
          <h1 style={{margin:0,fontSize:20,fontWeight:700,color:'#c7d2fe'}}>🏠 Dream House 예약현황</h1>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={prevMonth} style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#e2e8f0',padding:'8px 14px',borderRadius:8,cursor:'pointer',fontSize:16}}>‹</button>
          <span style={{fontSize:18,fontWeight:700,color:'#c7d2fe',minWidth:80,textAlign:'center'}}>{year}년 {MONTH_KO[month]}</span>
          <button onClick={nextMonth} style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#e2e8f0',padding:'8px 14px',borderRadius:8,cursor:'pointer',fontSize:16}}>›</button>
          <button onClick={()=>{setYear(today.getFullYear());setMonth(today.getMonth())}} style={{background:'#4f46e5',border:'none',color:'white',padding:'8px 14px',borderRadius:8,cursor:'pointer',fontSize:13}}>오늘</button>
        </div>
      </div>

      {/* 범례 */}
      <div style={{padding:'12px 24px',display:'flex',gap:20,flexWrap:'wrap',borderBottom:'1px solid #1e1b4b',background:'#0f0f1a'}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:14,borderRadius:3,background:'#4f46e5'}}></div><span style={{fontSize:12,color:'#94a3b8'}}>예약 있음</span></div>
        <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:14,borderRadius:3,background:'#ef4444'}}></div><span style={{fontSize:12,color:'#94a3b8'}}>중복 예약</span></div>
        <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:14,borderRadius:3,background:'#f59e0b',border:'2px solid #fbbf24'}}></div><span style={{fontSize:12,color:'#94a3b8'}}>⚠️ 시간 충돌 주의 (레이트체크아웃/새벽체크인)</span></div>
        <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:14,borderRadius:3,background:'#1e293b',border:'1px solid #334155'}}></div><span style={{fontSize:12,color:'#94a3b8'}}>빈 날</span></div>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:60,color:'#6366f1',fontSize:18}}>불러오는 중...</div>
      ) : (
        <div style={{overflowX:'auto'}}>
          <table style={{borderCollapse:'collapse',minWidth:'100%'}}>
            <thead>
              <tr>
                <th style={{position:'sticky',left:0,zIndex:10,background:'#1e1b4b',padding:'10px 8px',fontSize:12,color:'#a5b4fc',borderRight:'2px solid #312e81',borderBottom:'2px solid #312e81',minWidth:70,textAlign:'center'}}>날짜</th>
                {ROOMS.map((room, ri) => (
                  <th key={room} style={{background:'#1e1b4b',padding:'10px 6px',fontSize:11,color:ROOM_COLORS[ri],borderRight:'1px solid #1e293b',borderBottom:'2px solid #312e81',minWidth:68,textAlign:'center',fontWeight:700}}>
                    {room}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map(({dateStr, day, dow}) => {
                const isToday = dateStr === toDateStr(today)
                const isSun = dow === 0
                const isSat = dow === 6
                const rowBg = isToday ? '#1e1b4b' : day % 2 === 0 ? '#0d0d1a' : '#0f0f1a'
                return (
                  <tr key={dateStr} style={{background:rowBg}}>
                    <td style={{
                      position:'sticky',left:0,zIndex:5,
                      background: isToday ? '#312e81' : rowBg,
                      padding:'6px 8px',
                      borderRight:'2px solid #312e81',
                      borderBottom:'1px solid #1e293b',
                      textAlign:'center',
                      fontSize:12,
                      fontWeight: isToday ? 800 : 400,
                      color: isToday ? '#c7d2fe' : isSun ? '#f87171' : isSat ? '#93c5fd' : '#94a3b8',
                      whiteSpace:'nowrap'
                    }}>
                      {isToday && <span style={{fontSize:9,color:'#818cf8',display:'block'}}>TODAY</span>}
                      {day}일 {DOW_KO[dow]}
                    </td>
                    {ROOMS.map((room, ri) => {
                      const cellBookings = cellMap[dateStr][room] || []
                      const hasBooking = cellBookings.length > 0
                      const isDouble = cellBookings.length > 1
                      const isConflict = conflictSet.has(`${dateStr}_${room}`)
                      const isCheckin = cellBookings.some(b => b.checkin_date === dateStr)
                      const isCheckout = cellBookings.some(b => b.checkout_date === toDateStr(new Date(new Date(dateStr).getTime() + 86400000)))

                      let cellBg = 'transparent'
                      let cellBorder = '1px solid #1e293b'
                      let glowStyle = {}

                      if (isDouble) {
                        cellBg = '#7f1d1d'
                        cellBorder = '1px solid #ef4444'
                      } else if (isConflict) {
                        cellBg = '#78350f'
                        cellBorder = '2px solid #f59e0b'
                        glowStyle = {boxShadow:'inset 0 0 8px rgba(245,158,11,0.4)'}
                      } else if (hasBooking) {
                        cellBg = ROOM_COLORS[ri] + '33'
                        cellBorder = `1px solid ${ROOM_COLORS[ri]}66`
                      }

                      const b = cellBookings[0]

                      return (
                        <td
                          key={room}
                          onClick={() => b && router.push(`/invoice?id=${b.id}`)}
                          onMouseEnter={e => b && setTooltip({x:(e.target as HTMLElement).getBoundingClientRect().left, y:(e.target as HTMLElement).getBoundingClientRect().top, booking:b})}
                          onMouseLeave={() => setTooltip(null)}
                          style={{
                            padding:'4px 4px',
                            borderRight:'1px solid #1e293b',
                            borderBottom:'1px solid #1e293b',
                            background: cellBg,
                            border: cellBorder,
                            cursor: hasBooking ? 'pointer' : 'default',
                            textAlign:'center',
                            verticalAlign:'middle',
                            minWidth:68,
                            height:36,
                            position:'relative',
                            transition:'all 0.15s',
                            ...glowStyle
                          }}
                        >
                          {isConflict && (
                            <div style={{fontSize:14,lineHeight:1}}>⚠️</div>
                          )}
                          {isDouble && (
                            <div style={{fontSize:9,color:'#fca5a5',fontWeight:700}}>중복!</div>
                          )}
                          {!isDouble && !isConflict && isCheckin && b && (
                            <div style={{fontSize:9,color:ROOM_COLORS[ri],fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',padding:'0 2px'}}>
                              {b.booking_number || b.guest_name || 'IN'}
                            </div>
                          )}
                          {!isDouble && hasBooking && (
                            <div style={{position:'absolute',bottom:2,left:0,right:0,display:'flex',justifyContent:'center',gap:2}}>
                              {isCheckin && <span style={{width:5,height:5,borderRadius:'50%',background:'#4ade80',display:'inline-block'}} title="체크인"/>}
                              {isCheckout && <span style={{width:5,height:5,borderRadius:'50%',background:'#fb923c',display:'inline-block'}} title="체크아웃"/>}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 툴팁 */}
      {tooltip && (
        <div style={{
          position:'fixed',
          left: Math.min(tooltip.x, window.innerWidth-220),
          top: tooltip.y - 10,
          transform:'translateY(-100%)',
          background:'#1e1b4b',
          border:'1px solid #4f46e5',
          borderRadius:10,
          padding:'12px 16px',
          zIndex:1000,
          minWidth:180,
          pointerEvents:'none',
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)'
        }}>
          <div style={{fontWeight:700,color:'#c7d2fe',marginBottom:6}}>{tooltip.booking.accom_room}</div>
          <div style={{fontSize:12,color:'#94a3b8'}}>예약번호: <span style={{color:'#e2e8f0'}}>{tooltip.booking.booking_number || '-'}</span></div>
          <div style={{fontSize:12,color:'#94a3b8'}}>투숙객: <span style={{color:'#e2e8f0'}}>{tooltip.booking.guest_name || '-'}</span></div>
          <div style={{fontSize:12,color:'#94a3b8'}}>체크인: <span style={{color:'#4ade80'}}>{tooltip.booking.checkin_date} {tooltip.booking.checkin_time || ''}</span></div>
          <div style={{fontSize:12,color:'#94a3b8'}}>체크아웃: <span style={{color:'#fb923c'}}>{tooltip.booking.checkout_date} {tooltip.booking.checkout_time || ''}</span></div>
        </div>
      )}
    </div>
  )
}
