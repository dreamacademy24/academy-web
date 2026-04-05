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
  'b17L10','b17L11','b17L12','b17L13','b17L14','b17L15','b17L16','b17L17','b17L18'
]

const ROOM_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316',
  '#eab308','#22c55e','#10b981','#14b8a6','#06b6d4',
  '#3b82f6','#6366f1','#a855f7','#d946ef','#f43f5e','#0ea5e9','#84cc16'
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
  // 같은 룸, 같은 날짜에 checkout_date=당일인 예약의 checkout_time과 checkin_date=다음날인 예약의 checkin_time이 너무 가까울때
  const conflictSet = new Set<string>() // "dateStr_room"
  ROOMS.forEach(room => {
    const roomBookings = bookings.filter(b => b.accom_room === room)
    roomBookings.forEach(b1 => {
      roomBookings.forEach(b2 => {
        if (b1.id === b2.id) return
        // b1 체크아웃날 = b2 체크인날 (당일 전환)
        if (b1.checkout_date === b2.checkin_date) {
          const outTime = parseTime(b1.checkout_time)
          const inTime = parseTime(b2.checkin_time)
          // 체크아웃과 체크인 간격이 2시간 미만이면 충돌 경고
          if (inTime > 0 && outTime > 0 && inTime - outTime < 120) {
            conflictSet.add(`${b1.checkout_date}_${room}`)
          }
          // 새벽 체크인 (0~6시)이면 무조건 경고
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
    <div style={{minHeight:'100vh',background:'#f8fafc',color:'#1e293b',fontFamily:'sans-serif'}}>
      {/* 헤더 */}
      <div style={{background:'#1e40af',padding:'20px 24px',borderBottom:'1px solid #1e3a8a',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <button onClick={()=>router.push('/admin')} style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#dbeafe',padding:'8px 14px',borderRadius:8,cursor:'pointer',fontSize:13}}>← 어드민</button>
          <h1 style={{margin:0,fontSize:20,fontWeight:700,color:'#ffffff'}}>🏠 Dream House 예약현황</h1>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={prevMonth} style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#ffffff',padding:'8px 14px',borderRadius:8,cursor:'pointer',fontSize:16}}>‹</button>
          <span style={{fontSize:18,fontWeight:700,color:'#ffffff',minWidth:80,textAlign:'center'}}>{year}년 {MONTH_KO[month]}</span>
          <button onClick={nextMonth} style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#ffffff',padding:'8px 14px',borderRadius:8,cursor:'pointer',fontSize:16}}>›</button>
          <button onClick={()=>{setYear(today.getFullYear());setMonth(today.getMonth())}} style={{background:'#2563eb',border:'1px solid #3b82f6',color:'white',padding:'8px 14px',borderRadius:8,cursor:'pointer',fontSize:13}}>오늘</button>
        </div>
      </div>

      {/* 범례 */}
      <div style={{padding:'12px 24px',display:'flex',gap:20,flexWrap:'wrap',borderBottom:'1px solid #e2e8f0',background:'#ffffff'}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:14,borderRadius:3,background:'#3b82f6'}}></div><span style={{fontSize:12,color:'#475569'}}>예약 있음</span></div>
        <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:14,borderRadius:3,background:'#ef4444'}}></div><span style={{fontSize:12,color:'#475569'}}>중복 예약</span></div>
        <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:14,borderRadius:3,background:'#f59e0b',border:'2px solid #fbbf24'}}></div><span style={{fontSize:12,color:'#475569'}}>⚠️ 시간 충돌 주의 (레이트체크아웃/새벽체크인)</span></div>
        <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:14,borderRadius:3,background:'#f1f5f9',border:'1px solid #cbd5e1'}}></div><span style={{fontSize:12,color:'#475569'}}>빈 날</span></div>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:60,color:'#3b82f6',fontSize:18}}>불러오는 중...</div>
      ) : (
        <div style={{overflowX:'auto'}}>
          <table style={{borderCollapse:'collapse',minWidth:'100%'}}>
            <thead>
              <tr>
                <th style={{position:'sticky',left:0,zIndex:10,background:'#1e3a8a',padding:'10px 8px',fontSize:12,color:'#dbeafe',borderRight:'2px solid #1e40af',borderBottom:'2px solid #1e40af',minWidth:70,textAlign:'center'}}>날짜</th>
                {ROOMS.map((room, ri) => (
                  <th key={room} style={{background:'#1e3a8a',padding:'10px 6px',fontSize:11,color:ROOM_COLORS[ri],borderRight:'1px solid #1e40af',borderBottom:'2px solid #1e40af',minWidth:68,textAlign:'center',fontWeight:700}}>
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
                const rowBg = isToday ? '#eff6ff' : day % 2 === 0 ? '#f1f5f9' : '#ffffff'
                return (
                  <tr key={dateStr} style={{background:rowBg}}>
                    <td style={{
                      position:'sticky',left:0,zIndex:5,
                      background: isToday ? '#dbeafe' : rowBg,
                      padding:'6px 8px',
                      borderRight:'2px solid #cbd5e1',
                      borderBottom:'1px solid #e2e8f0',
                      textAlign:'center',
                      fontSize:12,
                      fontWeight: isToday ? 800 : 400,
                      color: isToday ? '#1e40af' : isSun ? '#dc2626' : isSat ? '#2563eb' : '#475569',
                      whiteSpace:'nowrap'
                    }}>
                      {isToday && <span style={{fontSize:9,color:'#1e40af',display:'block'}}>TODAY</span>}
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
                      let cellBorder = '1px solid #e2e8f0'
                      let glowStyle = {}

                      if (isDouble) {
                        cellBg = '#fef2f2'
                        cellBorder = '1px solid #ef4444'
                      } else if (isConflict) {
                        cellBg = '#fffbeb'
                        cellBorder = '2px solid #f59e0b'
                        glowStyle = {boxShadow:'inset 0 0 8px rgba(245,158,11,0.2)'}
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
                            borderRight:'1px solid #e2e8f0',
                            borderBottom:'1px solid #e2e8f0',
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
                            <div style={{fontSize:9,color:'#dc2626',fontWeight:700}}>중복!</div>
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
          background:'#ffffff',
          border:'1px solid #cbd5e1',
          borderRadius:10,
          padding:'12px 16px',
          zIndex:1000,
          minWidth:180,
          pointerEvents:'none',
          boxShadow:'0 8px 32px rgba(0,0,0,0.15)'
        }}>
          <div style={{fontWeight:700,color:'#1e40af',marginBottom:6}}>{tooltip.booking.accom_room}</div>
          <div style={{fontSize:12,color:'#64748b'}}>예��번호: <span style={{color:'#1e293b'}}>{tooltip.booking.booking_number || '-'}</span></div>
          <div style={{fontSize:12,color:'#64748b'}}>투숙객: <span style={{color:'#1e293b'}}>{tooltip.booking.guest_name || '-'}</span></div>
          <div style={{fontSize:12,color:'#64748b'}}>체크인: <span style={{color:'#16a34a'}}>{tooltip.booking.checkin_date} {tooltip.booking.checkin_time || ''}</span></div>
          <div style={{fontSize:12,color:'#64748b'}}>체크아웃: <span style={{color:'#ea580c'}}>{tooltip.booking.checkout_date} {tooltip.booking.checkout_time || ''}</span></div>
        </div>
      )}
    </div>
  )
}
