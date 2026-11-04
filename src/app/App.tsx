import { useEffect, useState } from 'react'
import { StartWorkoutScreen } from '../features/plans/LogWorkoutButton'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { supabaseConfigured } from '../db/supabase'
import { claimLocalData } from '../db/sync'
import { startSyncLoop } from '../db/syncController'
import { setCurrentUserId } from '../db/user'
import { ExerciseDetailScreen } from '../features/exercises/ExerciseDetailScreen'
import { ExerciseFormScreen } from '../features/exercises/ExerciseFormScreen'
import { LibraryScreen } from '../features/exercises/LibraryScreen'
import { SessionScreen } from '../features/log/SessionScreen'
import { detectPlatform, readPlatformSignals } from '../lib/platform'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { SignInScreen } from '../features/auth/SignInScreen'
import { LogScreen } from '../features/log/LogScreen'
import { MoreScreen } from '../features/more/MoreScreen'
import { InstallScreen } from '../features/onboarding/InstallScreen'
import { GoalsScreen } from '../features/more/GoalsScreen'
import { PlanBuilderScreen } from '../features/plans/PlanBuilderScreen'
import { PlanEditorScreen } from '../features/plans/PlanEditorScreen'
import { PlanHistoryScreen } from '../features/plans/PlanHistoryScreen'
import { PlanSessionScreen } from '../features/plans/PlanSessionScreen'
import { PlansScreen } from '../features/plans/PlansScreen'
import { RatingScreen } from '../features/plans/RatingScreen'
import { DataScreen } from '../features/data/DataScreen'
import { ReportScreen } from '../features/reports/ReportScreen'
import { ReportsScreen } from '../features/reports/ReportsScreen'
import { refreshPush } from '../features/settings/push'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { SetupWizard } from '../features/settings/SetupWizard'
import { MuscleScreen } from '../features/progress/MuscleScreen'
import { PlanFollowScreen } from '../features/progress/PlanFollowScreen'
import { ProgressScreen } from '../features/progress/ProgressScreen'
import { TodayScreen } from '../features/today/TodayScreen'
import { BootScreen } from './BootScreen'
import { ErrorBoundary } from './ErrorBoundary'
import { Layout } from './Layout'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <TodayScreen /> },
      { path: '/log', element: <LogScreen /> },
      { path: '/start', element: <StartWorkoutScreen /> },
      { path: '/log/new', element: <StartWorkoutScreen past /> },
      { path: '/log/session/:id', element: <SessionScreen /> },
      { path: '/exercises', element: <LibraryScreen /> },
      { path: '/exercises/new', element: <ExerciseFormScreen /> },
      { path: '/exercises/:id', element: <ExerciseDetailScreen /> },
      { path: '/exercises/:id/edit', element: <ExerciseFormScreen /> },
      { path: '/progress', element: <ProgressScreen /> },
      { path: '/progress/plan', element: <PlanFollowScreen /> },
      { path: '/progress/muscles', element: <MuscleScreen /> },
      { path: '/data', element: <DataScreen /> },
      { path: '/plans', element: <PlansScreen /> },
      { path: '/plans/new', element: <PlanBuilderScreen /> },
      { path: '/plans/:planId', element: <PlanEditorScreen /> },
      { path: '/plans/:planId/add', element: <PlanBuilderScreen /> },
      { path: '/plans/:planId/sessions/:sessionId', element: <PlanSessionScreen /> },
      { path: '/plans/:planId/history', element: <PlanHistoryScreen /> },
      { path: '/plans/:planId/rating', element: <RatingScreen /> },
      { path: '/reports', element: <ReportsScreen /> },
      { path: '/reports/:week', element: <ReportScreen /> },
      { path: '/goals', element: <GoalsScreen /> },
      { path: '/more', element: <MoreScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
      { path: '/settings/setup', element: <SetupWizard /> },
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
  if (loading) return <BootScreen waitingFor="sign-in" />
  if (!session) return <SignInScreen />
  return <SignedIn userId={session.user.id} />
}

/** Binds local data to the signed-in user and runs background sync while signed in. */
function SignedIn({ userId }: { userId: string }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setCurrentUserId(userId)
    let stop: (() => void) | undefined
    claimLocalData(userId)
      .then(() => {
        setReady(true)
        stop = startSyncLoop()
        void refreshPush()
      })
      .catch((e: unknown) =>
        setError(
          `Couldn’t open the workout storage on this phone (${e instanceof Error ? e.message : String(e)}).`,
        ),
      )
    return () => {
      stop?.()
      setCurrentUserId(null)
    }
  }, [userId])
  if (!ready) return <BootScreen waitingFor="workout storage" error={error ?? undefined} />
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
