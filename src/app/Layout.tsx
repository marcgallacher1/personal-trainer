import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { TabBar } from './TabBar'

export function Layout() {
  const navigate = useNavigate()

  // Deep links from notification taps when the app is already open (see sw.ts notificationclick).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (e: MessageEvent<{ type?: string; url?: string }>) => {
      if (e.data.type === 'navigate' && e.data.url) void navigate(e.data.url)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])

  return (
    <div className="min-h-full pt-safe">
      <main className="mx-auto max-w-xl px-safe pt-4 pb-28">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="mb-4 text-3xl font-bold tracking-tight">{children}</h1>
}
