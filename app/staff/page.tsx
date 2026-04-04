'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { isAdminAuthed, getAdminInfo } from '@/lib/adminAuth'

function StaffIframe() {
  const sp = useSearchParams()
  const router = useRouter()
  const [src, setSrc] = useState('')

  useEffect(() => {
    if (!isAdminAuthed()) {
      router.replace('/admin')
      return
    }
    const userParam = sp.get('user')
    const info = getAdminInfo()
    const userId = userParam || info?.staffId || ''
    if (userId) {
      setSrc('/team_manager2_4.html?user=' + encodeURIComponent(userId))
    } else {
      setSrc('/team_manager2_4.html')
    }
  }, [sp, router])

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
