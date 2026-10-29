import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { supabaseConfigured } from '../db/supabase'
import { detectPlatform, readPlatformSignals } from '../lib/platform'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { SignInScreen } from '../features/auth/SignInScreen'
import { LogScreen } from '../features/log/LogScreen'
import { MoreScreen } from '../features/more/MoreScreen'
import { InstallScreen } from '../features/onboarding/InstallScreen'
import { PlansScreen } from '../features/plans/PlansScreen'
import { ProgressScreen } from '../features/progress/ProgressScreen'
import { TodayScreen } from '../features/today/TodayScreen'
import { ErrorBoundary } from './ErrorBoundary'
import { Layout } from './Layout'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <TodayScreen /> },
      { path: '/log', element: <LogScreen /> },
      { path: '/progress', element: <ProgressScreen /> },
      { path: '/plans', element: <PlansScreen /> },
      { path: '/more', element: <MoreScreen /> },
      { path: '*', element: <TodayScreen /> },
    ],
  },
])

const BYPASS_INSTALL_KEY = 'trainer-bypass-install'

function Gate() {
  const { session, loading } = useAuth()
  const [bypassInstall, setBypassInstall] = useState(
    () => sessionStorage.getItem(BYPASS_INSTALL_KEY) === '1',
  )
  const platform = detectPlatform(readPlatformSignals())

  if (!supabaseConfigured) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold">Missing configuration</h1>
        <p className="mt-2 text-muted">
          Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).
        </p>
      </div>
    )
  }
  if (platform.needsInstall && !bypassInstall) {
    return (
      <InstallScreen
        onContinue={() => {
          sessionStorage.setItem(BYPASS_INSTALL_KEY, '1')
          setBypassInstall(true)
        }}
      />
    )
  }
  if (loading) return null
  if (!session) return <SignInScreen />
  return <RouterProvider router={router} />
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ErrorBoundary>
  )
}
