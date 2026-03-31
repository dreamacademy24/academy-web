'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ROOMS = ["b13L10","b16L19","b17L4","b17L7","b17L8","b17L9","b17L10","b17L11","b17L12","b17L13","b17L14","b17L15","b17L16","b17L17","b17L18"]

export default function DreamhouseRooms() {
  const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('adminAuthed')) {
      router.push('/admin')
    }
  }, [])

  useEffect(() => {
    supabase.from('bookings').select('id, reservation_no, accom_room, checkin_date, checkout_date').then(({ data }) => {
      if (data) setBookings(data)
    })
  }, [])

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y-1) } else setMonth(m => m-1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y+1) } else setMonth(m => m+1) }

  const getBookingsForCell = (room: string, day: number) => {
    const date = new Date(year, month, day)
    return bookings.filter(b => {
      if (b.accom_room !== room) return false
      const ci = new Date(b.checkin_date)
      const co = new Date(b.checkout_date)
      return date >= ci && date < co
    })
  }

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => router.push('/admin/bookings')}>← 어드민</button>
        <button onClick={prevMonth}>‹</button>
        <strong>{year}년 {month+1}월</strong>
        <button onClick={nextMonth}>›</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: '4px 8px', background: '#f5f5f5', border: '1px solid #ddd', minWidth: 72 }}>방</th>
              {Array.from({ length: daysInMonth }, (_, i) => i+1).map(d => (
                <th key={d} style={{
                  padding: '4px 2px', minWidth: 32, textAlign: 'center',
                  background: d === today.getDate() && month === today.getMonth() && year === today.getFullYear() ? '#dbeafe' : '#f5f5f5',
                  border: '1px solid #ddd', fontSize: 11
                }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROOMS.map(room => (
              <tr key={room}>
                <td style={{ padding: '4px 8px', background: '#f5f5f5', border: '1px solid #ddd', fontWeight: 500, whiteSpace: 'nowrap' }}>{room}</td>
                {Array.from({ length: daysInMonth }, (_, i) => i+1).map(d => {
                  const hits = getBookingsForCell(room, d)
                  const isDouble = hits.length > 1
                  const isBooked = hits.length === 1
                  const isStart = isBooked && new Date(hits[0].checkin_date).getDate() === d && new Date(hits[0].checkin_date).getMonth() === month
                  return (
                    <td key={d}
                      onClick={() => hits.length > 0 && router.push(`/invoice?id=${hits[0].id}`)}
                      style={{
                        border: '1px solid #ddd', height: 28, cursor: hits.length > 0 ? 'pointer' : 'default',
                        background: isDouble ? '#E24B4A' : isBooked ? '#3A86FF' : 'white',
                        position: 'relative'
                      }}>
                      {isStart && (
                        <span style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', color: 'white', fontSize: 10, whiteSpace: 'nowrap', fontWeight: 500 }}>
                          {hits[0].reservation_no}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
