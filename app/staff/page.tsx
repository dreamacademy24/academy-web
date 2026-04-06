'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { isAdminAuthed, getAdminInfo } from '@/lib/adminAuth'

interface NotifItem { icon: string; msg: string }

function StaffIframe() {
  const sp = useSearchParams()
  const [src, setSrc] = useState('')
  const [notifs, setNotifs] = useState<NotifItem[]>([])

  useEffect(() => {
    if (!isAdminAuthed()) {
      window.location.href = '/admin'
      return
    }
    const info = getAdminInfo()
    const rawUser = sp.get('user') || info?.staffId || ''
    const userId = rawUser.replace(/^admin-/, '')
    if (userId) {
      setSrc('/team_manager5.html?user=' + encodeURIComponent(userId))
    } else {
      window.location.href = '/admin'
    }
  }, [sp])

  useEffect(() => {
    function handleMsg(e: MessageEvent) {
      if (e.data?.type === 'DA_NOTIFICATION' && Array.isArray(e.data.updates)) {
        setNotifs(e.data.updates)
        setTimeout(() => setNotifs([]), 8000)
      }
    }
    window.addEventListener('message', handleMsg)
    return () => window.removeEventListener('message', handleMsg)
  }, [])

  if (!src) return null
  return (
    <>
      <iframe src={src} style={{ width: '100%', height: '100dvh', border: 'none' }} />
      {notifs.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 340,
        }}>
          {notifs.map((n, i) => (
            <div
              key={i}
              style={{
                background: '#1a1a2e', color: '#fff', borderRadius: 14,
                padding: '14px 18px', display: 'flex', alignItems: 'center',
                gap: 10, boxShadow: '0 4px 24px rgba(0,0,0,0.28)',
                animation: 'slideInRight 0.35s ease',
                cursor: 'default',
              }}
            >
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1, lineHeight: 1.5 }}>{n.msg}</span>
              <button
                onClick={() => setNotifs(prev => prev.filter((_, j) => j !== i))}
                style={{
                  background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                  borderRadius: 6, width: 24, height: 24, cursor: 'pointer',
                  fontSize: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>
          ))}
        </div>
      )}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

export default function StaffPage() {
  return (
    <Suspense>
      <StaffIframe />
    </Suspense>
  )
}
