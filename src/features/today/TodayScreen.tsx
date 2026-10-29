import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { PageTitle } from '../../app/Layout'
import { ComingSoon } from '../../components/ComingSoon'
import { db } from '../../db/local'
import { pullReference } from '../../db/sync'
import { useAuth } from '../auth/AuthProvider'

type PullState =
  { kind: 'loading' } | { kind: 'ok'; count: number } | { kind: 'error'; message: string }

export function TodayScreen() {
  const { session } = useAuth()
  const [pull, setPull] = useState<PullState>({ kind: 'loading' })
  const localCount = useLiveQuery(() => db.exercises.count(), [])
  const [now] = useState(() => new Date())

  useEffect(() => {
    pullReference()
      .then(({ exercises }) => setPull({ kind: 'ok', count: exercises }))
      .catch((e: unknown) =>
        setPull({ kind: 'error', message: e instanceof Error ? e.message : String(e) }),
      )
  }, [])

  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/London',
  }).format(now)

  return (
    <>
      <p className="text-sm text-muted">{today}</p>
      <PageTitle>Today</PageTitle>
      <div className="flex flex-col gap-4">
        <section className="rounded-2xl bg-surface p-4">
          <p className="text-sm text-muted">Signed in as</p>
          <p className="truncate text-lg">{session?.user.email}</p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Stat
            label="Exercises (server)"
            value={pull.kind === 'ok' ? pull.count : pull.kind === 'loading' ? '…' : '—'}
          />
          <Stat label="Cached offline" value={localCount ?? '…'} />
        </section>
        {pull.kind === 'error' && (
          <p className="text-sm text-danger">
            Couldn't reach the server ({pull.message}). Showing cached data.
          </p>
        )}

        <ComingSoon phase="Phase 3">
          Your planned workout, streak and protein ring will appear here.
        </ComingSoon>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  )
}
