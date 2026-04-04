'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function StaffIframe() {
  const sp = useSearchParams()
  const user = sp.get('user')
  const token = sp.get('token')
  let src = '/team_manager2_4.html'
  if (user && token) src += `?user=${encodeURIComponent(user)}&token=${encodeURIComponent(token)}`
  return (
    <iframe
      src={src}
      style={{ width: '100%', height: '100vh', border: 'none' }}
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
