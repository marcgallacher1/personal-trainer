import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { Button } from '../../components/Button'
import {
  useActiveSession,
  useExercises,
  useSessionSummaries,
  type SessionSummary,
} from '../../db/queries'
import { monthGrid, shiftMonth } from '../../lib/time/calendar'
import { cardioName } from '../../lib/cardio'
import { StartPlanSheet } from '../plans/StartPlanSheet'
import { formatDuration, londonDate, sessionTitle } from './format'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function LogScreen() {
  const [choosing, setChoosing] = useState(false)
  const active = useActiveSession()
  const summaries = useSessionSummaries()
  const exercises = useExercises()
  const [today] = useState(() => londonDate(new Date().toISOString()))
  const [ym, setYm] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const map = new Map<string, SessionSummary[]>()
    for (const s of summaries ?? []) {
      const day = londonDate(s.session.started_at)
      map.set(day, [...(map.get(day) ?? []), s])
    }
    return map
  }, [summaries])

  const monthKey = `${ym.year}-${String(ym.month).padStart(2, '0')}`
  const visible = (summaries ?? []).filter((s) => {
    const day = londonDate(s.session.started_at)
    return selectedDay ? day === selectedDay : day.startsWith(monthKey)
  })
  const names = new Map((exercises ?? []).map((e) => [e.id, e.name]))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between">
        <PageTitle>Log</PageTitle>
        <Link to="/exercises" className="mb-4 text-sm font-semibold text-accent">
          Exercises
        </Link>
      </div>

      {active ? (
        <Link
          to={`/log/session/${active.id}`}
          className="block rounded-3xl bg-accent p-5 text-accent-fg"
        >
          <p className="text-sm font-semibold opacity-80">
            In progress · {formatDuration(active.started_at, null)}
          </p>
          <p className="text-2xl font-bold">{sessionTitle(active)}</p>
          <p className="mt-1 font-semibold">Resume ›</p>
        </Link>
      ) : (
        <Button className="h-16 text-xl" onClick={() => setChoosing(true)}>
          Start plan
        </Button>
      )}
      <StartPlanSheet open={choosing} onClose={() => setChoosing(false)} />

      <section className="rounded-3xl bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            className="h-10 w-10 rounded-full text-xl text-muted"
            onClick={() => {
              setYm(shiftMonth(ym.year, ym.month, -1))
              setSelectedDay(null)
            }}
          >
            ‹
          </button>
          <h2 className="font-bold">
            {new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(
              new Date(Date.UTC(ym.year, ym.month - 1, 15)),
            )}
          </h2>
          <button
            type="button"
            aria-label="Next month"
            className="h-10 w-10 rounded-full text-xl text-muted"
            onClick={() => {
              setYm(shiftMonth(ym.year, ym.month, 1))
              setSelectedDay(null)
            }}
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
          {WEEKDAYS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {monthGrid(ym.year, ym.month)
            .flat()
            .map((day, i) =>
              day ? (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                  className={`relative flex aspect-square items-center justify-center rounded-xl text-sm tabular-nums ${
                    selectedDay === day
                      ? 'bg-accent font-bold text-accent-fg'
                      : byDay.has(day)
                        ? 'bg-accent/20 font-semibold text-text'
                        : 'text-muted'
                  } ${day === today ? 'ring-2 ring-accent' : ''}`}
                >
                  {Number(day.slice(8))}
                </button>
              ) : (
                <span key={`pad-${i}`} />
              ),
            )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
          {selectedDay
            ? new Intl.DateTimeFormat('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }).format(new Date(`${selectedDay}T12:00:00Z`))
            : 'This month'}
        </h2>
        {visible.length === 0 && (
          <p className="rounded-2xl bg-surface p-4 text-center text-muted">
            {summaries?.length ? 'No workouts here.' : 'No workouts yet. Start one above!'}
          </p>
        )}
        {visible.map(({ session, setCount, volume, exerciseIds, cardio }) => (
          <Link
            key={session.id}
            to={`/log/session/${session.id}`}
            className="block rounded-2xl bg-surface p-4 active:opacity-80"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-bold">{sessionTitle(session)}</p>
              <p className="shrink-0 text-xs text-muted">
                {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
                  new Date(session.started_at),
                )}
              </p>
            </div>
            <p className="text-sm text-muted">
              {session.ended_at
                ? formatDuration(session.started_at, session.ended_at)
                : 'In progress'}{' '}
              {setCount > 0 && ` · ${setCount} sets`}
              {volume > 0 && ` · ${Math.round(volume).toLocaleString('en-GB')} kg`}
              {cardio.minutes > 0 &&
                ` · ${cardio.minutes} min cardio${cardio.calories ? ` (${cardio.calories} kcal)` : ''}`}
            </p>
            {(exerciseIds.length > 0 || cardio.activities.length > 0) && (
              <p className="mt-1 truncate text-sm">
                {[...exerciseIds.map((id) => names.get(id)), ...cardio.activities.map(cardioName)]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
          </Link>
        ))}
      </section>
    </div>
  )
}
