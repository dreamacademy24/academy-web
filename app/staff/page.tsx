'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function StaffIframe() {
  const sp = useSearchParams()
  const user = sp.get('user')
  let src = '/team_manager2_4.html'
  if (user) src += `?user=${encodeURIComponent(user)}`
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
