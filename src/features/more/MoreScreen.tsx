import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { Button } from '../../components/Button'
import { ComingSoon } from '../../components/ComingSoon'
import { Confirm } from '../../components/Confirm'
import { showToast } from '../../components/Toast'
import { useOutboxCount } from '../../db/queries'
import { supabase } from '../../db/supabase'
import { clearLocalData } from '../../db/sync'
import { useAuth } from '../auth/AuthProvider'
import { countSampleWorkouts, loadSampleWorkouts, removeSampleWorkouts } from './sample'

async function signOut() {
  await supabase.auth.signOut()
  await clearLocalData()
}

export function MoreScreen() {
  const { session } = useAuth()
  const pending = useOutboxCount() ?? 0
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <PageTitle>More</PageTitle>
      <div className="flex flex-col gap-4">
        <Link
          to="/goals"
          className="flex items-center gap-3 rounded-2xl bg-surface p-4 active:opacity-80"
        >
          <span className="text-2xl">🎯</span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold">Goals</span>
            <span className="block text-sm text-muted">
              Bulk or cut, training focus, workouts per week, muscle focus
            </span>
          </span>
          <span className="text-2xl text-muted">›</span>
        </Link>

        <ComingSoon phase="Phases 4–8">Reports, Data and Settings will live here.</ComingSoon>

        <SampleData />

        <section className="rounded-2xl bg-surface p-4">
          <p className="text-sm text-muted">Signed in as</p>
          <p className="truncate text-lg">{session?.user.email}</p>
        </section>

        {confirming ? (
          <div className="flex flex-col gap-3">
            {pending > 0 && (
              <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
                {pending} change{pending === 1 ? " hasn't" : "s haven't"} synced yet and will be
                lost if you sign out now. Get online first.
              </p>
            )}
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Sign out
          </Button>
        )}
        <p className="text-center text-xs text-muted">Trainer v{__APP_VERSION__}</p>
      </div>
    </>
  )
}

/** Fake workout history for trying out Progress; tagged so it can be removed cleanly. */
function SampleData() {
  const count = useLiveQuery(countSampleWorkouts, [])
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  if (count === undefined) return null

  async function run(task: () => Promise<number>, done: (n: number) => string) {
    setBusy(true)
    try {
      showToast({ message: done(await task()) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl bg-surface p-4">
      <p className="text-lg font-bold">Sample workouts</p>
      <p className="mb-3 text-sm text-muted">
        {count
          ? `${count} sample workouts are loaded. They’re tagged, so removing them never touches workouts you logged yourself.`
          : 'Fill Progress with 12 weeks of made-up workouts that follow your active plan, to see how the charts work.'}
      </p>
      {count ? (
        <Button variant="secondary" disabled={busy} onClick={() => setConfirmRemove(true)}>
          {busy ? 'Working…' : 'Remove sample workouts'}
        </Button>
      ) : (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void run(loadSampleWorkouts, (n) => `Added ${n} sample workouts`)}
        >
          {busy ? 'Adding…' : 'Load sample workouts'}
        </Button>
      )}
      <Confirm
        open={confirmRemove}
        title={`Remove ${count} sample workouts?`}
        body="Only the generated sample workouts are removed."
        confirmLabel="Remove"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false)
          void run(removeSampleWorkouts, (n) => `Removed ${n} sample workouts`)
        }}
      />
    </section>
  )
}
