import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { Button } from '../../components/Button'
import { ComingSoon } from '../../components/ComingSoon'
import { useActiveSession, useSessionSummaries } from '../../db/queries'
import { startSession } from '../log/actions'
import { formatDuration, sessionTitle } from '../log/format'

export function TodayScreen() {
  const navigate = useNavigate()
  const active = useActiveSession()
  const summaries = useSessionSummaries()
  const [now] = useState(() => new Date())
  const last = summaries?.find((s) => s.session.ended_at !== null)

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
        {active ? (
          <Link
            to={`/log/session/${active.id}`}
            className="block rounded-3xl bg-accent p-5 text-accent-fg"
          >
            <p className="text-sm font-semibold opacity-80">In progress</p>
            <p className="text-2xl font-bold">{sessionTitle(active)}</p>
            <p className="mt-1 font-semibold">Resume ›</p>
          </Link>
        ) : (
          <Button
            className="h-16 text-xl"
            onClick={async () => {
              const id = await startSession()
              void navigate(`/log/session/${id}`)
            }}
          >
            Start workout
          </Button>
        )}

        {last && (
          <Link to={`/log/session/${last.session.id}`} className="block rounded-2xl bg-surface p-4">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">Last workout</p>
            <p className="mt-1 font-bold">{sessionTitle(last.session)}</p>
            <p className="text-sm text-muted">
              {new Intl.DateTimeFormat('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              }).format(new Date(last.session.started_at))}{' '}
              · {formatDuration(last.session.started_at, last.session.ended_at)} · {last.setCount}{' '}
              sets
            </p>
          </Link>
        )}

        <ComingSoon phase="Phase 3">
          Your planned workout, streak and protein ring will appear here.
        </ComingSoon>
      </div>
    </>
  )
}
