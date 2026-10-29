import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { Button } from '../../components/Button'
import { useActiveSession, useSessionSummaries } from '../../db/queries'
import { isoWeekday, weekProgress, weekStart, type WorkoutRef } from '../../lib/plans/schedule'
import { versionTitle } from '../../lib/plans/templates'
import { startSession } from '../log/actions'
import { formatDuration, londonDate, sessionTitle } from '../log/format'
import { startFromPlan, usePlanLibrary, useProfile } from '../plans/data'
import { StartPlanSheet } from '../plans/StartPlanSheet'
import { WEEKDAYS } from '../plans/WeekdayPicker'

export function TodayScreen() {
  const navigate = useNavigate()
  const active = useActiveSession()
  const summaries = useSessionSummaries()
  const library = usePlanLibrary()
  const profile = useProfile()
  const [now] = useState(() => new Date())
  const [choosing, setChoosing] = useState(false)

  const today = londonDate(now.toISOString())
  const weekday = isoWeekday(today)
  const workouts: WorkoutRef[] = (summaries ?? []).map((s) => ({
    plan_session_id: s.session.plan_session_id,
    started_at: s.session.started_at,
    day: londonDate(s.session.started_at),
    active: s.setCount > 0 || s.cardio.minutes > 0,
  }))
  const week = weekProgress(workouts, today, profile?.sessions_per_week ?? 4)
  const last = summaries?.find((s) => s.session.ended_at !== null)
  const trainedToday = workouts.some((w) => w.day === today && w.active)
  const scheduled = (library ?? []).flatMap((p) =>
    p.versions
      .filter((v) => p.schedule.some((s) => s.plan_session_id === v.id && s.weekday === weekday))
      .map((v) => ({ plan: p.plan, version: v })),
  )

  async function go(start: () => Promise<string>) {
    const id = await start()
    void navigate(`/log/session/${id}`)
  }

  const heading = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/London',
  }).format(now)

  return (
    <>
      <p className="text-sm text-muted">{heading}</p>
      <PageTitle>Today</PageTitle>
      <div className="flex flex-col gap-4">
        {active ? (
          <Link
            to={`/log/session/${active.id}`}
            className="block rounded-3xl bg-accent p-5 text-accent-fg"
          >
            <p className="text-sm font-semibold opacity-80">
              In progress · {formatDuration(active.started_at, null, now.getTime())}
            </p>
            <p className="text-2xl font-bold">{sessionTitle(active)}</p>
            <p className="mt-1 font-semibold">Resume ›</p>
          </Link>
        ) : (
          <section className="flex flex-col gap-2">
            {!trainedToday &&
              scheduled.map(({ plan, version }) => (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => void go(() => startFromPlan(version))}
                  className="flex items-center gap-3 rounded-3xl bg-accent/15 p-4 text-left ring-2 ring-accent"
                >
                  <span className="text-3xl">{version.emoji ?? '🏋️'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold tracking-wide text-accent uppercase">
                      Scheduled for {WEEKDAYS[weekday - 1]}
                    </span>
                    <span className="block text-xl font-bold">
                      Start {versionTitle(plan.name, version.name)}
                    </span>
                  </span>
                  <span className="text-2xl text-accent">›</span>
                </button>
              ))}
            <Button className="h-16 text-xl" onClick={() => setChoosing(true)}>
              Start plan
            </Button>
            <button
              type="button"
              className="h-12 rounded-xl bg-surface font-semibold text-muted"
              onClick={() => void go(startSession)}
            >
              Empty workout
            </button>
          </section>
        )}

        <WeekCard done={week.done} target={week.target} days={week.days} today={today} />

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
              · {formatDuration(last.session.started_at, last.session.ended_at)}
              {last.setCount > 0 && ` · ${last.setCount} sets`}
            </p>
          </Link>
        )}
      </div>

      <StartPlanSheet open={choosing} onClose={() => setChoosing(false)} />
    </>
  )
}

function WeekCard({
  done,
  target,
  days,
  today,
}: {
  done: number
  target: number
  days: string[]
  today: string
}) {
  const start = weekStart(today)
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${start}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })
  const trained = new Set(days)
  const hit = done >= target
  return (
    <section className="rounded-2xl bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">This week</p>
        <p className={`text-sm font-bold ${hit ? 'text-success' : ''}`}>
          {done} / {target} workouts {hit ? '✓' : ''}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {dates.map((d, i) => (
          <div key={d} className="flex flex-col items-center gap-1">
            <span className={`text-xs ${d === today ? 'font-bold text-text' : 'text-muted'}`}>
              {WEEKDAYS[i]!.slice(0, 1)}
            </span>
            <span
              className={`h-8 w-8 rounded-full ${
                trained.has(d) ? 'bg-accent' : d === today ? 'ring-2 ring-accent' : 'bg-surface-2'
              }`}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
