import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { Sheet } from '../../components/Sheet'
import { useExercises, useSessionSummaries } from '../../db/queries'
import { DAY_NAMES } from '../../lib/plans/draft'
import type { PlanSessionRow } from '../../lib/plans/instantiate'
import { isoWeekday, weekStart } from '../../lib/plans/schedule'
import { londonToIso } from '../../lib/time/london'
import { markApplied, todayExtras, usePlanChanges } from '../coach/data'
import { addExercise, startSession, type PastTimes } from '../log/actions'
import { londonDate } from '../log/format'
import { suggestWorkout } from '../../lib/plans/suggest'
import { useTrainingData } from '../progress/data'
import { startFromPlan, usePlanLibrary } from './data'

const SHORT_DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * "Start workout" (live, timed) or, with `past`, "Log workout" (asks when it was).
 * Offers the active plan's workouts: today's first, then what's left this week, then what's done.
 */
export function LogWorkoutButton({ past = false }: { past?: boolean }) {
  const navigate = useNavigate()
  const library = usePlanLibrary()
  const summaries = useSessionSummaries()
  const exercises = useExercises()
  const training = useTrainingData()
  const extras = todayExtras(usePlanChanges())
  const [open, setOpen] = useState(false)
  const [now] = useState(() => new Date())
  const todayDate = londonDate(now.toISOString())
  const today = isoWeekday(todayDate)
  const [when, setWhen] = useState({ date: todayDate, time: '18:00', minutes: 60 })

  const active = (library ?? []).find((p) => p.plan.is_active)
  const daysOf = (s: PlanSessionRow) =>
    (active?.schedule ?? [])
      .filter((d) => d.plan_session_id === s.id && d.weekday !== null)
      .map((d) => d.weekday!)
      .toSorted((a, b) => a - b)

  // Days each plan workout was done this week
  const monday = weekStart(todayDate)
  const doneOn = new Map<string, number[]>()
  for (const s of summaries ?? []) {
    const id = s.session.plan_session_id
    const day = londonDate(s.session.started_at)
    if (!id || day < monday || (s.setCount === 0 && s.cardio.minutes === 0)) continue
    doneOn.set(id, [...(doneOn.get(id) ?? []), isoWeekday(day)])
  }
  const doneText = (s: PlanSessionRow) => {
    const days = doneOn.get(s.id)
    return days?.length ? `✓ Done ${days.map((d) => SHORT_DAY[d - 1]).join(', ')}` : null
  }
  const timesLeft = (s: PlanSessionRow) =>
    Math.max(1, daysOf(s).length) - (doneOn.get(s.id)?.length ?? 0)

  const movesOf = (s: PlanSessionRow) => extras.moved.filter((m) => m.workoutId === s.id)
  const foldsInto = (s: PlanSessionRow) => extras.folds.filter((f) => f.intoWorkoutId === s.id)
  const nameOf = (id: string) => exercises?.find((e) => e.id === id)?.name ?? 'Exercise'
  const plan = active?.versions ?? []
  // Best workout for today: not done this week, muscles rested, missed ones first
  const suggestion =
    !past && training && active
      ? suggestWorkout({
          today: todayDate,
          workouts: plan.map((s) => ({
            id: s.id,
            name: s.name,
            days: daysOf(s),
            exerciseIds: active.exercises
              .filter((e) => e.plan_session_id === s.id)
              .map((e) => e.exercise_id),
          })),
          sessions: training.sessions.map((s) => ({
            date: s.date,
            workoutId: s.planSessionId,
            sets: s.sets,
          })),
          info: training.ctx.exercises,
          muscleName: (id) => training.ctx.muscles.find((m) => m.id === id)?.name ?? id,
        })
      : null
  const trainedToday = (training?.sessions ?? []).some((s) => s.date === todayDate)
  const todays = past
    ? []
    : plan.filter((s) => s.id === suggestion?.workoutId || movesOf(s).length > 0)
  const rest = plan.filter((s) => !todays.includes(s))
  const left = rest.filter((s) => timesLeft(s) > 0)
  const done = rest.filter((s) => timesLeft(s) <= 0)

  const times = (): PastTimes | undefined => {
    if (!past) return undefined
    const startedAt = londonToIso(when.date, when.time)
    return {
      startedAt,
      endedAt: new Date(Date.parse(startedAt) + when.minutes * 60_000).toISOString(),
    }
  }

  async function go(start: () => Promise<string>) {
    const id = await start()
    setOpen(false)
    void navigate(`/log/session/${id}`)
  }

  /** Starts a plan workout, adding any lifts folded in from a missed one. */
  function startPlanned(s: PlanSessionRow) {
    void go(async () => {
      const id = await startFromPlan(s, times())
      if (!past) {
        for (const f of foldsInto(s)) {
          for (const exId of f.exerciseIds) {
            const ex = exercises?.find((e) => e.id === exId)
            if (ex) await addExercise(id, ex)
          }
          await markApplied(f.change)
        }
        for (const m of movesOf(s)) await markApplied(m.change)
      }
      return id
    })
  }

  /** Why it's suggested, plus "Moved to today" / "+ Bench Press from Push" */
  const todayDetail = (s: PlanSessionRow) =>
    [
      s.id === suggestion?.workoutId && suggestion.why,
      movesOf(s).length > 0 && 'Moved to today',
      ...foldsInto(s).map((f) => {
        const from = plan.find((v) => v.id === f.fromWorkoutId)?.name
        return `+ ${f.exerciseIds.map(nameOf).join(', ')}${from ? ` from ${from}` : ''}`
      }),
    ]
      .filter(Boolean)
      .join(' · ') || undefined
  const daysText = (s: PlanSessionRow) => {
    const days = daysOf(s)
    return days.length ? days.map((d) => DAY_NAMES[d - 1]).join(', ') : 'Any day'
  }
  const label = past ? 'Log workout' : 'Start workout'

  return (
    <>
      <Button
        className="h-16 text-xl"
        onClick={() => (active || past ? setOpen(true) : void go(() => startSession()))}
      >
        {label}
      </Button>
      {todays.length > 0 && (
        <p className="-mt-1 text-center text-sm text-muted">
          {trainedToday ? 'Next up' : 'Suggested today'}:{' '}
          <b className="text-text">{todays.map((s) => s.name).join(' + ')}</b>
        </p>
      )}

      <Sheet
        open={open}
        title={label}
        subtitle={past ? 'Pick when you trained' : active?.plan.name}
        closeLabel="Cancel"
        onClose={() => setOpen(false)}
      >
        <div className="flex flex-col gap-5">
          {past && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">When</h3>
              <Row label="Day">
                <input
                  type="date"
                  value={when.date}
                  max={todayDate}
                  onChange={(e) => e.target.value && setWhen({ ...when, date: e.target.value })}
                  className={INPUT}
                />
              </Row>
              <Row label="Started">
                <input
                  type="time"
                  value={when.time}
                  onChange={(e) => e.target.value && setWhen({ ...when, time: e.target.value })}
                  className={INPUT}
                />
              </Row>
              <Row label="Minutes">
                <input
                  inputMode="numeric"
                  value={when.minutes || ''}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    setWhen({ ...when, minutes: Math.min(600, Number(e.target.value) || 0) })
                  }
                  className={INPUT}
                />
              </Row>
            </section>
          )}

          <Group
            title={trainedToday ? 'Next up' : `Suggested today · ${DAY_NAMES[today - 1]}`}
            items={todays}
          >
            {(s) => (
              <WorkoutRow
                key={s.id}
                session={s}
                highlight
                detail={todayDetail(s)}
                onStart={() => startPlanned(s)}
              />
            )}
          </Group>

          <Group title={past ? 'From your plan' : 'Left this week'} items={past ? plan : left}>
            {(s) => (
              <WorkoutRow
                key={s.id}
                session={s}
                detail={(past ? doneText(s) : null) ?? daysText(s)}
                onStart={() => startPlanned(s)}
              />
            )}
          </Group>

          {!past && (
            <Group title="Done this week" items={done}>
              {(s) => (
                <WorkoutRow
                  key={s.id}
                  session={s}
                  muted
                  detail={doneText(s) ?? undefined}
                  onStart={() => startPlanned(s)}
                />
              )}
            </Group>
          )}

          <button
            type="button"
            onClick={() => void go(() => startSession(times()))}
            className="h-14 rounded-2xl border border-dashed border-border font-semibold"
          >
            Custom workout
          </button>
        </div>
      </Sheet>
    </>
  )
}

const INPUT =
  'h-full min-w-0 flex-1 appearance-none bg-transparent text-right text-lg tabular-nums outline-none'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex h-14 items-center gap-3 rounded-xl bg-surface px-4 focus-within:ring-2 focus-within:ring-accent">
      <span className="shrink-0 font-semibold">{label}</span>
      {children}
    </label>
  )
}

function Group({
  title,
  items,
  children,
}: {
  title: string
  items: PlanSessionRow[]
  children: (s: PlanSessionRow) => React.ReactNode
}) {
  if (!items.length) return null
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      <div className="flex flex-col gap-2">{items.map(children)}</div>
    </section>
  )
}

function WorkoutRow({
  session,
  detail,
  highlight = false,
  muted = false,
  onStart,
}: {
  session: PlanSessionRow
  detail?: string
  highlight?: boolean
  muted?: boolean
  onStart: () => void
}) {
  return (
    <button
      type="button"
      onClick={onStart}
      className={`flex items-center gap-3 rounded-2xl p-4 text-left active:opacity-80 ${
        highlight ? 'bg-accent text-accent-fg' : 'bg-surface'
      } ${muted ? 'opacity-60' : ''}`}
    >
      <span className="text-2xl">{session.emoji ?? '🏋️'}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-bold">{session.name}</span>
        {detail && (
          <span className={`block truncate text-sm ${highlight ? 'opacity-80' : 'text-muted'}`}>
            {detail}
          </span>
        )}
      </span>
      <span className="text-sm font-bold">Start ›</span>
    </button>
  )
}
