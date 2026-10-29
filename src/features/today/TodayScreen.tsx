import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { Button } from '../../components/Button'
import { Sheet } from '../../components/Sheet'
import { useActiveSession, useSessionSummaries } from '../../db/queries'
import type { PlanSessionRow } from '../../lib/plans/instantiate'
import {
  isoWeekday,
  nextInRotation,
  sessionsForWeekday,
  weekProgress,
  weekStart,
  type WorkoutRef,
} from '../../lib/plans/schedule'
import { startSession } from '../log/actions'
import { formatDuration, londonDate, sessionTitle } from '../log/format'
import { WEEKDAYS } from '../plans/PlanEditorScreen'
import { startFromPlan, useActivePlan, usePlanRows, useProfile } from '../plans/data'

export function TodayScreen() {
  const navigate = useNavigate()
  const active = useActiveSession()
  const summaries = useSessionSummaries()
  const plan = useActivePlan()
  const rows = usePlanRows(plan?.id)
  const profile = useProfile()
  const [now] = useState(() => new Date())
  const [choosing, setChoosing] = useState(false)

  const today = londonDate(now.toISOString())
  const workouts: WorkoutRef[] = (summaries ?? []).map((s) => ({
    plan_session_id: s.session.plan_session_id,
    started_at: s.session.started_at,
    day: londonDate(s.session.started_at),
    active: s.setCount > 0 || s.cardio.minutes > 0,
  }))
  const week = weekProgress(workouts, today, profile?.sessions_per_week ?? 4)
  const last = summaries?.find((s) => s.session.ended_at !== null)

  const sessions = rows?.sessions ?? []
  const weekdayMode = rows?.plan.schedule_mode === 'weekday'
  const doneToday = workouts.filter((w) => w.day === today && w.active)
  const suggestions: PlanSessionRow[] = !rows
    ? []
    : weekdayMode
      ? sessionsForWeekday(sessions, rows.schedule, isoWeekday(today))
      : [nextInRotation(sessions, workouts)].filter((s): s is PlanSessionRow => s !== null)

  async function start(s: PlanSessionRow) {
    setChoosing(false)
    const id = await startFromPlan(s)
    void navigate(`/log/session/${id}`)
  }

  async function startEmpty() {
    setChoosing(false)
    const id = await startSession()
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
        {active && (
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
        )}

        {!active && plan === null && (
          <div className="rounded-3xl bg-surface p-5">
            <p className="text-xl font-bold">Set up your plan</p>
            <p className="mt-1 text-sm text-muted">
              Add your sessions once and Today will tell you what’s next.
            </p>
            <div className="mt-3 flex gap-2">
              <Link
                to="/plans"
                className="flex h-12 flex-1 items-center justify-center rounded-xl bg-accent font-bold text-accent-fg"
              >
                Create a plan
              </Link>
              <button
                type="button"
                className="h-12 flex-1 rounded-xl bg-surface-2 font-semibold"
                onClick={() => void startEmpty()}
              >
                Empty workout
              </button>
            </div>
          </div>
        )}

        {!active && plan && rows && (
          <section className="rounded-3xl bg-surface p-5">
            {suggestions.length > 0 ? (
              <>
                <p className="text-sm font-semibold text-muted">
                  {doneToday.length > 0 ? 'Next time' : weekdayMode ? 'Today’s session' : 'Next up'}
                </p>
                {suggestions.map((s) => {
                  const count = rows.exercises.filter((e) => e.plan_session_id === s.id).length
                  return (
                    <div key={s.id} className="mt-1">
                      <p className="text-2xl font-bold">
                        {s.emoji ? `${s.emoji} ` : ''}
                        {s.name}
                      </p>
                      <p className="text-sm text-muted">{count} exercises</p>
                      <Button className="mt-3 h-16 w-full text-xl" onClick={() => void start(s)}>
                        Start {s.name}
                      </Button>
                    </div>
                  )
                })}
              </>
            ) : (
              <>
                <p className="text-2xl font-bold">Rest day 😌</p>
                <p className="text-sm text-muted">Nothing scheduled in {plan.name} today.</p>
              </>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="h-12 rounded-xl bg-surface-2 text-sm font-semibold"
                onClick={() => setChoosing(true)}
              >
                Choose another
              </button>
              <button
                type="button"
                className="h-12 rounded-xl bg-surface-2 text-sm font-semibold"
                onClick={() => void startEmpty()}
              >
                Empty workout
              </button>
            </div>
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

      <Sheet
        open={choosing}
        title="Choose a session"
        subtitle={plan?.name}
        closeLabel="Cancel"
        onClose={() => setChoosing(false)}
      >
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => void start(s)}
              className="flex items-center gap-3 rounded-2xl bg-surface p-4 text-left"
            >
              <span className="text-2xl">{s.emoji ?? '🏋️'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-bold">{s.name}</span>
                <span className="block text-sm text-muted">
                  {rows?.exercises.filter((e) => e.plan_session_id === s.id).length ?? 0} exercises
                </span>
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => void startEmpty()}
            className="h-14 rounded-2xl border border-dashed border-border font-semibold text-muted"
          >
            Empty workout instead
          </button>
        </div>
      </Sheet>
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
