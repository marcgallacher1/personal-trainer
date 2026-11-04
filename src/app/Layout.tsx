import { useEffect } from 'react'
import { Outlet, ScrollRestoration, useNavigate } from 'react-router'
import { SyncPill } from '../components/SyncPill'
import { ToastHost } from '../components/Toast'
import { sweepEmptyWorkouts } from '../features/plans/data'
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

  // Shortly after opening (once the first sync has run), tidy away old empty workouts
  useEffect(() => {
    const t = setTimeout(() => void sweepEmptyWorkouts(), 5000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-full pt-safe">
      <main className="mx-auto max-w-xl px-safe pt-2 pb-28">
        <div className="flex h-9 justify-end">
          <SyncPill />
        </div>
        <Outlet />
      </main>
      <ToastHost />
      {/* New screens open at the top; going back returns to where you were */}
      <ScrollRestoration />
      <TabBar />
    </div>
  )
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="mb-4 text-3xl font-bold tracking-tight">{children}</h1>
}
