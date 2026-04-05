'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { isAdminAuthed, getAdminInfo } from '@/lib/adminAuth'

function StaffIframe() {
  const sp = useSearchParams()
  const [src, setSrc] = useState('')

  useEffect(() => {
    if (!isAdminAuthed()) {
      window.location.href = '/admin'
      return
    }

    const info = getAdminInfo()
    // ?user= 파라미터 우선, 없으면 로그인 계정에서 추출
    // admin-eric → eric, admin-ceo → ceo, ceo → ceo
    const rawUser = sp.get('user') || info?.staffId || ''
    const userId = rawUser.replace(/^admin-/, '')

    if (userId) {
      setSrc('/team_manager3.html?user=' + encodeURIComponent(userId))
    } else {
      window.location.href = '/admin'
    }
  }, [sp])

  if (!src) return null
  return (
    <iframe
      src={src}
      style={{ width: '100%', height: '100dvh', border: 'none' }}
    />
  )
}

export default function StaffPage() {
  return (
    <Suspense>
      <StaffIframe />
    </Suspense>
  )
}
