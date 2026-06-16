'use client'
import { useState, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { isAdminAuthed } from '@/lib/adminAuth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ROOMS = [
  'b13L10','b16L19',
  'b17L7','b17L8','b17L9',
  'b17L10','b17L11','b17L12','b17L13','b17L14','b17L15','b17L16','b17L17','b17L18'
]

const ROOM_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316',
  '#eab308','#22c55e','#10b981','#14b8a6','#06b6d4',
  '#3b82f6','#6366f1','#a855f7','#0ea5e9','#84cc16'
]

type Booking = {
  id: string
  accom_room: string
  checkin_date: string
  checkout_date: string
  booker_name?: string
  reservation_no?: string
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function toDateStr(date: Date) {
  // 로컬 타임존 기준 YYYY-MM-DD (toISOString은 UTC로 변환되어 KST/PHT에서 하루 밀림)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function DreamhouseRooms() {
  const router = useRouter()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [viewMode, setViewMode] = useState<'grid'|'calendar'>('grid')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState<{x:number,y:number,booking:Booking}|null>(null)
  const [modal, setModal] = useState<Booking|null>(null)
  const [modalRoom, setModalRoom] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!isAdminAuthed()) router.push('/admin')
    }
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [year, month])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const key = `dh_notes_${year}_${month+1}`
      setNotes(localStorage.getItem(key) || '')
    }
  }, [year, month])

  function saveNotes(val: string) {
    setNotes(val)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`dh_notes_${year}_${month+1}`, val)
    }
  }

  async function fetchBookings() {
    setLoading(true)
    const firstDay = `${year}-${String(month+1).padStart(2,'0')}-01`
    // 마지막달(현재 +2개월)의 말일까지 조회
    const lastMonthDate = new Date(year, month + 2, 1)
    const ly = lastMonthDate.getFullYear()
    const lm = lastMonthDate.getMonth()
    const lastDay = `${ly}-${String(lm+1).padStart(2,'0')}-${getDaysInMonth(ly, lm)}`
    const res = await fetch(`/api/dreamhouse?firstDay=${firstDay}&lastDay=${lastDay}`)
    const data = await res.json()
    // 콤보 예약: 드림하우스 구간(seg)이 있으면 그 구간 날짜로만 룸 점유 표시 (전체 기간 X)
    const arr = (Array.isArray(data) ? data : []).map((b: Record<string, string>) => {
      let dhCi: string | null = null, dhCo: string | null = null
      if (b.seg1_type === 'dreamhouse') { dhCi = b.seg1_checkin; dhCo = b.seg1_checkout }
      else if (b.seg2_type === 'dreamhouse') { dhCi = b.seg2_checkin; dhCo = b.seg2_checkout }
      if (dhCi && dhCo) return { ...b, checkin_date: String(dhCi).split('T')[0], checkout_date: String(dhCo).split('T')[0] }
      return b
    })
    setBookings(arr as unknown as Booking[])
    setLoading(false)
  }

  const daysInMonth = getDaysInMonth(year, month)
  // 현재 월 + 다음 2개월 (총 3개월치) 날짜 연속 생성
  const dates: { dateStr: string; day: number; dow: number; monthLabel: string | null }[] = []
  for (let mOffset = 0; mOffset < 3; mOffset++) {
    const md = new Date(year, month + mOffset, 1)
    const my = md.getFullYear()
    const mm = md.getMonth()
    const mDays = getDaysInMonth(my, mm)
    for (let i = 0; i < mDays; i++) {
      const date = new Date(my, mm, i+1)
      dates.push({
        dateStr: toDateStr(date),
        day: i+1,
        dow: date.getDay(),
        monthLabel: (mOffset > 0 && i === 0) ? `${my}년 ${mm + 1}월` : null,
      })
    }
  }

  // 날짜별 룸별 예약 매핑
  const cellMap: Record<string, Record<string, Booking[]>> = {}
  dates.forEach(({dateStr}) => {
    cellMap[dateStr] = {}
    ROOMS.forEach(r => { cellMap[dateStr][r] = [] })
  })
  bookings.forEach(b => {
    // 문자열 직접 비교 (YYYY-MM-DD는 lexicographic 정렬이 시간순과 동일, timezone 영향 없음)
    // 체크인 당일 ~ 체크아웃 당일까지 inclusive 블록
    dates.forEach(({dateStr}) => {
      if (dateStr >= b.checkin_date && dateStr <= b.checkout_date) {
        if (cellMap[dateStr][b.accom_room]) {
          cellMap[dateStr][b.accom_room].push(b)
        }
      }
    })
  })

  // 당일 전환 충돌 감지 (같은 룸에서 체크아웃일 = 다른 예약 체크인일)
  const conflictSet = new Set<string>() // "dateStr_room"
  ROOMS.forEach(room => {
    const roomBookings = bookings.filter(b => b.accom_room === room)
    roomBookings.forEach(b1 => {
      roomBookings.forEach(b2 => {
        if (b1.id === b2.id) return
        if (b1.checkout_date === b2.checkin_date) {
          conflictSet.add(`${b1.checkout_date}_${room}`)
        }
      })
    })
  })

  // 사이드패널 통계 (같은 월 데이터 기반)
  const monthFirstDay = `${year}-${String(month+1).padStart(2,'0')}-01`
  const monthLastDay = `${year}-${String(month+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`
  const monthlyCheckins = bookings.filter(b => b.checkin_date >= monthFirstDay && b.checkin_date <= monthLastDay).length
  const monthlyCheckouts = bookings.filter(b => b.checkout_date >= monthFirstDay && b.checkout_date <= monthLastDay).length

  const duplicates: {date:string,room:string,count:number}[] = []
  Object.entries(cellMap).forEach(([date, rooms]) => {
    Object.entries(rooms).forEach(([room, bs]) => {
      if (bs.length > 1) duplicates.push({date, room, count: bs.length})
    })
  })

  const conflicts: {date:string,room:string}[] = []
  conflictSet.forEach(key => {
    const idx = key.indexOf('_')
    conflicts.push({date: key.slice(0,idx), room: key.slice(idx+1)})
  })

  const emptyRooms = ROOMS.filter(r => !bookings.some(b => b.accom_room === r))

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
    <div style={{minHeight:'100vh',background:'#f8fafc',color:'#1e293b',fontFamily:'sans-serif',display:'flex'}}>
      {/* 사이드패널 */}
      <aside style={{width:260,flexShrink:0,background:'#f8fafc',borderRight:'1px solid #e2e8f0',padding:16,height:'100vh',position:'sticky',top:0,overflowY:'auto'}}>
        {/* 헤더 */}
        <div style={{marginBottom:16}}>
          <button onClick={()=>router.push('/admin')} style={{background:'transparent',border:'1px solid #cbd5e1',color:'#475569',padding:'6px 10px',borderRadius:6,cursor:'pointer',fontSize:12,marginBottom:10}}>← 어드민</button>
          <h1 style={{margin:0,fontSize:17,fontWeight:700,color:'#1e293b'}}>🏠 Dream House 예약현황</h1>
        </div>

        {/* 범례 */}
        <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:'10px 12px',marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:'#64748b',marginBottom:8,letterSpacing:0.5}}>범례</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:12,height:12,borderRadius:3,background:'#3b82f6'}}></div><span style={{fontSize:11,color:'#475569'}}>예약 있음</span></div>
            <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:12,height:12,borderRadius:3,background:'#ef4444'}}></div><span style={{fontSize:11,color:'#475569'}}>중복 예약</span></div>
            <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:12,height:12,borderRadius:3,background:'#f59e0b',border:'2px solid #fbbf24'}}></div><span style={{fontSize:11,color:'#475569'}}>⚠️ 시간 충돌</span></div>
            <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:12,height:12,borderRadius:3,background:'#f1f5f9',border:'1px solid #cbd5e1'}}></div><span style={{fontSize:11,color:'#475569'}}>빈 날</span></div>
          </div>
        </div>

        {/* 이번 달 요약 */}
        <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:'12px 14px',marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:'#1e293b',marginBottom:10}}>📋 이번 달 요약</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:'#64748b'}}>총 예약</span><span style={{fontWeight:700,color:'#1e40af'}}>{bookings.length}건</span></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:'#64748b'}}>체크인 예정</span><span style={{fontWeight:700,color:'#16a34a'}}>{monthlyCheckins}건</span></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:'#64748b'}}>체크아웃 예정</span><span style={{fontWeight:700,color:'#ea580c'}}>{monthlyCheckouts}건</span></div>
          </div>
        </div>

        {/* 확인 필요 */}
        <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:'12px 14px',marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:'#1e293b',marginBottom:10}}>⚠️ 확인 필요</div>
          {duplicates.length === 0 && conflicts.length === 0 ? (
            <div style={{fontSize:11,color:'#94a3b8'}}>이상 없음</div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {duplicates.map((d,i)=>(
                <div key={`dup-${i}`} style={{display:'flex',alignItems:'center',gap:6,fontSize:11}}>
                  <span style={{background:'#dc2626',color:'#fff',padding:'2px 6px',borderRadius:4,fontWeight:700,fontSize:10,flexShrink:0}}>중복</span>
                  <span style={{color:'#475569'}}>{d.date} · {d.room}</span>
                </div>
              ))}
              {conflicts.map((c,i)=>(
                <div key={`con-${i}`} style={{display:'flex',alignItems:'center',gap:6,fontSize:11}}>
                  <span style={{background:'#f59e0b',color:'#fff',padding:'2px 6px',borderRadius:4,fontWeight:700,fontSize:10,flexShrink:0}}>충돌</span>
                  <span style={{color:'#475569'}}>{c.date} · {c.room}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 빈 방 현황 */}
        <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:'12px 14px',marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:'#1e293b',marginBottom:10}}>🏠 이번 달 빈 방</div>
          {emptyRooms.length === 0 ? (
            <div style={{fontSize:11,color:'#94a3b8'}}>모든 룸 예약 있음</div>
          ) : (
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {emptyRooms.map(r=>(
                <span key={r} style={{background:'#f1f5f9',color:'#475569',padding:'3px 8px',borderRadius:4,fontSize:11,fontWeight:600}}>{r}</span>
              ))}
            </div>
          )}
        </div>

        {/* 이달 메모 */}
        <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:'12px 14px',marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:'#1e293b',marginBottom:8}}>📝 이달 메모</div>
          <textarea
            value={notes}
            onChange={e=>saveNotes(e.target.value)}
            placeholder="메모를 입력하세요..."
            style={{width:'100%',minHeight:100,padding:8,border:'1px solid #e2e8f0',borderRadius:6,fontSize:12,resize:'vertical',fontFamily:'inherit',color:'#1e293b',boxSizing:'border-box',outline:'none'}}
          />
        </div>
      </aside>

      {/* 캘린더 영역 */}
      <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
        {/* 월 네비게이션 */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,padding:'14px 24px',borderBottom:'1px solid #e2e8f0',background:'#ffffff'}}>
          <button onClick={prevMonth} style={{background:'#f1f5f9',border:'1px solid #cbd5e1',color:'#475569',padding:'7px 14px',borderRadius:8,cursor:'pointer',fontSize:14}}>‹</button>
          <span style={{fontSize:16,fontWeight:700,color:'#1e293b',minWidth:130,textAlign:'center'}}>{year}년 {MONTH_KO[month]}</span>
          <button onClick={nextMonth} style={{background:'#f1f5f9',border:'1px solid #cbd5e1',color:'#475569',padding:'7px 14px',borderRadius:8,cursor:'pointer',fontSize:14}}>›</button>
          <button onClick={()=>{setYear(today.getFullYear());setMonth(today.getMonth())}} style={{background:'#1e40af',border:'1px solid #1e3a8a',color:'#fff',padding:'7px 14px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,marginLeft:8}}>오늘</button>
          <span style={{width:1,height:22,background:'#e2e8f0',margin:'0 4px'}} />
          <button onClick={()=>setViewMode('grid')} style={{
            padding:'4px 12px', borderRadius:6, fontSize:13,
            background: viewMode==='grid' ? '#1e3a8a' : '#e2e8f0',
            color: viewMode==='grid' ? '#fff' : '#475569',
            border:'none', cursor:'pointer'
          }}>≡ 그리드</button>
          <button onClick={()=>setViewMode('calendar')} style={{
            padding:'4px 12px', borderRadius:6, fontSize:13,
            background: viewMode==='calendar' ? '#1e3a8a' : '#e2e8f0',
            color: viewMode==='calendar' ? '#fff' : '#475569',
            border:'none', cursor:'pointer', marginLeft:4
          }}>📅 달력</button>
        </div>

        {loading ? (
          <div style={{textAlign:'center',padding:60,color:'#3b82f6',fontSize:18}}>불러오는 중...</div>
        ) : viewMode === 'grid' ? (
          <div style={{overflowX:'auto',flex:1}}>
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
              {dates.map(({dateStr, day, dow, monthLabel}) => {
                const isToday = dateStr === toDateStr(today)
                const isSun = dow === 0
                const isSat = dow === 6
                const rowBg = isToday ? '#eff6ff' : day % 2 === 0 ? '#f1f5f9' : '#ffffff'
                const isNewMonth = !!monthLabel
                const monthPrefix = isNewMonth ? monthLabel!.replace(/\d+년 /, '') : ''
                return (
                  <Fragment key={dateStr}>
                  <tr style={{background:rowBg}}>
                    <td style={{
                      position:'sticky',left:0,zIndex:5,
                      background: isNewMonth ? '#1e3a8a' : (isToday ? '#dbeafe' : rowBg),
                      padding:'6px 8px',
                      borderRight:'2px solid #cbd5e1',
                      borderBottom:'1px solid #e2e8f0',
                      textAlign:'center',
                      fontSize:12,
                      fontWeight: isNewMonth ? 700 : (isToday ? 800 : 400),
                      color: isNewMonth ? '#dbeafe' : (isToday ? '#1e40af' : isSun ? '#dc2626' : isSat ? '#2563eb' : '#475569'),
                      whiteSpace:'nowrap'
                    }}>
                      {isToday && <span style={{fontSize:9,color:'#1e40af',display:'block'}}>TODAY</span>}
                      {isNewMonth
                        ? <>{monthPrefix}<br/>{day}일 {DOW_KO[dow]}</>
                        : <>{day}일 {DOW_KO[dow]}</>
                      }
                    </td>
                    {ROOMS.map((room, ri) => {
                      const cellBookings = cellMap[dateStr][room] || []
                      const hasBooking = cellBookings.length > 0
                      const isDouble = cellBookings.length > 1
                      const isConflict = conflictSet.has(`${dateStr}_${room}`)
                      const isCheckin = cellBookings.some(b => b.checkin_date === dateStr)
                      const isCheckout = cellBookings.some(b => b.checkout_date === dateStr)

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
                          onClick={() => { if(b){setModal(b);setModalRoom(b.accom_room);setTooltip(null);} }}
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
                              {b.booker_name || b.reservation_no || 'IN'}
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
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{flex:1,overflowY:'auto',padding:16}}>
          {(() => {
            const startDow = new Date(year, month, 1).getDay()
            const totalDays = getDaysInMonth(year, month)
            const cells: Date[] = []
            for (let i = 0; i < startDow; i++) cells.push(new Date(year, month, 1 - (startDow - i)))
            for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d))
            while (cells.length % 7 !== 0) cells.push(new Date(year, month, totalDays + (cells.length - startDow - totalDays + 1)))
            const weeks: Date[][] = []
            for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
            const todayStr = toDateStr(today)
            return (
              <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
                <thead>
                  <tr>
                    {DOW_KO.map((d, i) => (
                      <th key={d} style={{padding:'8px 4px',fontSize:13,fontWeight:700,borderBottom:'1px solid #e2e8f0',color: i===0?'#dc2626':i===6?'#2563eb':'#475569'}}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, wi) => (
                    <tr key={wi}>
                      {week.map((date, di) => {
                        const dateStr = toDateStr(date)
                        const inMonth = date.getMonth() === month
                        const isToday = dateStr === todayStr
                        const checkins = bookings.filter(b => b.checkin_date === dateStr)
                        const checkouts = bookings.filter(b => b.checkout_date === dateStr)
                        return (
                          <td key={di} style={{verticalAlign:'top',height:90,minWidth:0,border:'1px solid #e2e8f0',padding:4,background: inMonth ? '#fff' : '#f8fafc'}}>
                            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:3,height:22}}>
                              <span style={{
                                fontSize:12,
                                fontWeight: isToday ? 700 : 400,
                                color: !inMonth ? '#cbd5e1' : (di===0 ? '#dc2626' : di===6 ? '#2563eb' : '#475569'),
                                ...(isToday ? {background:'#1e40af',color:'#fff',borderRadius:'50%',width:22,height:22,display:'inline-flex',alignItems:'center',justifyContent:'center'} : {})
                              }}>{date.getDate()}</span>
                            </div>
                            <div style={{display:'flex',flexDirection:'column',gap:2}}>
                              {checkins.map(b => (
                                <div key={'in'+b.id} onClick={()=>{setModal(b);setModalRoom(b.accom_room)}} title={`${b.accom_room} ${b.booker_name||''} 체크인`} style={{cursor:'pointer',background:'#dcfce7',color:'#166534',fontSize:11,borderRadius:4,padding:'1px 5px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                  {b.accom_room} {b.booker_name || b.reservation_no || ''} in
                                </div>
                              ))}
                              {checkouts.map(b => (
                                <div key={'out'+b.id} onClick={()=>{setModal(b);setModalRoom(b.accom_room)}} title={`${b.accom_room} ${b.booker_name||''} 체크아웃`} style={{cursor:'pointer',background:'#ffedd5',color:'#9a3412',fontSize:11,borderRadius:4,padding:'1px 5px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                  {b.accom_room} {b.booker_name || b.reservation_no || ''} out
                                </div>
                              ))}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          })()}
        </div>
      )}
      </div>

      {/* 모달 */}
      {modal && (
        <div onClick={()=>setModal(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#ffffff',borderRadius:16,padding:'32px 28px',boxShadow:'0 12px 48px rgba(0,0,0,0.2)',minWidth:340,maxWidth:420,width:'90%'}}>
            <h3 style={{margin:'0 0 20px',fontSize:18,fontWeight:700,color:'#1e293b'}}>예약 상세</h3>
            <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:20}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                <span style={{color:'#64748b'}}>예약자명</span>
                <span style={{fontWeight:600,color:'#1e293b'}}>{modal.booker_name || '-'}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                <span style={{color:'#64748b'}}>예약번호</span>
                <span style={{fontWeight:600,color:'#1e293b'}}>{modal.reservation_no || '-'}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                <span style={{color:'#64748b'}}>체크인</span>
                <span style={{fontWeight:600,color:'#16a34a'}}>{modal.checkin_date}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                <span style={{color:'#64748b'}}>체크아웃</span>
                <span style={{fontWeight:600,color:'#ea580c'}}>{modal.checkout_date}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:13}}>
                <span style={{color:'#64748b'}}>현재 룸</span>
                <span style={{fontWeight:700,color:'#1e40af'}}>{modal.accom_room}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:13}}>
                <span style={{color:'#64748b'}}>룸 변경</span>
                <select value={modalRoom} onChange={e=>setModalRoom(e.target.value)} style={{padding:'6px 12px',border:'1px solid #cbd5e1',borderRadius:8,fontSize:13,color:'#1e293b',fontWeight:600}}>
                  {ROOMS.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={async()=>{
                if(modalRoom===modal.accom_room){alert('동일한 룸입니다.');return;}
                const{error}=await supabase.from('bookings').update({accom_room:modalRoom}).eq('id',modal.id);
                if(error){alert('변경 실패: '+error.message);return;}
                alert('✅ 룸이 '+modalRoom+'으로 변경되었습니다.');
                setModal(null);fetchBookings();
              }} style={{flex:1,padding:'10px 0',background:'#1e40af',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>변경 저장</button>
              <button onClick={()=>{setModal(null);router.push('/invoice?id='+modal.id);}} style={{flex:1,padding:'10px 0',background:'#f1f5f9',color:'#1e40af',border:'1px solid #cbd5e1',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>인보이스 보기</button>
              <button onClick={()=>setModal(null)} style={{padding:'10px 16px',background:'#fff',color:'#64748b',border:'1px solid #e2e8f0',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>닫기</button>
            </div>
          </div>
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
          <div style={{fontSize:12,color:'#64748b'}}>예약번호: <span style={{color:'#1e293b'}}>{tooltip.booking.reservation_no || '-'}</span></div>
          <div style={{fontSize:12,color:'#64748b'}}>예약자: <span style={{color:'#1e293b'}}>{tooltip.booking.booker_name || '-'}</span></div>
          <div style={{fontSize:12,color:'#64748b'}}>체크인: <span style={{color:'#16a34a'}}>{tooltip.booking.checkin_date}</span></div>
          <div style={{fontSize:12,color:'#64748b'}}>체크아웃: <span style={{color:'#ea580c'}}>{tooltip.booking.checkout_date}</span></div>
        </div>
      )}
    </div>
  )
}
