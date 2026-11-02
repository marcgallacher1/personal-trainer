import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { Sheet } from '../../components/Sheet'
import { DAY_NAMES } from '../../lib/plans/draft'
import type { PlanSessionRow } from '../../lib/plans/instantiate'
import { isoWeekday } from '../../lib/plans/schedule'
import { useExercises } from '../../db/queries'
import { markApplied, todayExtras, usePlanChanges } from '../coach/data'
import { addExercise, startSession } from '../log/actions'
import { londonDate } from '../log/format'
import { startFromPlan, usePlanLibrary } from './data'

/** "Log workout": offers the active plan's workouts (today's first), or starts a blank one. */
export function LogWorkoutButton() {
  const navigate = useNavigate()
  const library = usePlanLibrary()
  const [open, setOpen] = useState(false)
  const [today] = useState(() => isoWeekday(londonDate(new Date().toISOString())))

  const active = (library ?? []).find((p) => p.plan.is_active)
  const daysOf = (s: PlanSessionRow) =>
    (active?.schedule ?? [])
      .filter((d) => d.plan_session_id === s.id && d.weekday !== null)
      .map((d) => d.weekday!)
      .toSorted((a, b) => a - b)
  const exercises = useExercises()
  const extras = todayExtras(usePlanChanges())
  const movesOf = (s: PlanSessionRow) => extras.moved.filter((m) => m.workoutId === s.id)
  const foldsInto = (s: PlanSessionRow) => extras.folds.filter((f) => f.intoWorkoutId === s.id)
  const nameOf = (id: string) => exercises?.find((e) => e.id === id)?.name ?? 'Exercise'
  const todays = active
    ? active.versions.filter((s) => daysOf(s).includes(today) || movesOf(s).length > 0)
    : []
  const others = active ? active.versions.filter((s) => !todays.includes(s)) : []

  async function go(start: () => Promise<string>) {
    const id = await start()
    setOpen(false)
    void navigate(`/log/session/${id}`)
  }

  /** Starts a plan workout, adding any lifts folded in from a missed one. */
  function startPlanned(s: PlanSessionRow) {
    void go(async () => {
      const id = await startFromPlan(s)
      for (const f of foldsInto(s)) {
        for (const exId of f.exerciseIds) {
          const ex = exercises?.find((e) => e.id === exId)
          if (ex) await addExercise(id, ex)
        }
        await markApplied(f.change)
      }
      for (const m of movesOf(s)) await markApplied(m.change)
      return id
    })
  }

  /** "Moved to today" / "+ Bench Press from Push" */
  const todayDetail = (s: PlanSessionRow) =>
    [
      movesOf(s).length > 0 && 'Moved to today',
      ...foldsInto(s).map((f) => {
        const from = active?.versions.find((v) => v.id === f.fromWorkoutId)?.name
        return `+ ${f.exerciseIds.map(nameOf).join(', ')}${from ? ` from ${from}` : ''}`
      }),
    ]
      .filter(Boolean)
      .join(' · ') || undefined

  return (
    <>
      <Button
        className="h-16 text-xl"
        onClick={() => (active ? setOpen(true) : void go(startSession))}
      >
        Log workout
      </Button>
      {todays.length > 0 && (
        <p className="-mt-1 text-center text-sm text-muted">
          Today on {active!.plan.name}:{' '}
          <b className="text-text">{todays.map((s) => s.name).join(' + ')}</b>
        </p>
      )}

      <Sheet
        open={open}
        title="Log workout"
        subtitle={active?.plan.name}
        closeLabel="Cancel"
        onClose={() => setOpen(false)}
      >
        <div className="flex flex-col gap-5">
          {todays.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
                Today · {DAY_NAMES[today - 1]}
              </h3>
              <div className="flex flex-col gap-2">
                {todays.map((s) => (
                  <WorkoutRow
                    key={s.id}
                    session={s}
                    highlight
                    detail={todayDetail(s)}
                    onStart={() => startPlanned(s)}
                  />
                ))}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
                {todays.length ? 'Something else from your plan' : 'From your plan'}
              </h3>
              <div className="flex flex-col gap-2">
                {others.map((s) => {
                  const days = daysOf(s)
                  return (
                    <WorkoutRow
                      key={s.id}
                      session={s}
                      detail={
                        days.length ? days.map((d) => DAY_NAMES[d - 1]).join(', ') : 'Any day'
                      }
                      onStart={() => startPlanned(s)}
                    />
                  )
                })}
              </div>
            </section>
          )}

          <button
            type="button"
            onClick={() => void go(startSession)}
            className="h-14 rounded-2xl border border-dashed border-border font-semibold"
          >
            Custom workout
          </button>
        </div>
      </Sheet>
    </>
  )
}

function WorkoutRow({
  session,
  detail,
  highlight = false,
  onStart,
}: {
  session: PlanSessionRow
  detail?: string
  highlight?: boolean
  onStart: () => void
}) {
  return (
    <button
      type="button"
      onClick={onStart}
      className={`flex items-center gap-3 rounded-2xl p-4 text-left active:opacity-80 ${
        highlight ? 'bg-accent text-accent-fg' : 'bg-surface'
      }`}
    >
      <span className="text-2xl">{session.emoji ?? '🏋️'}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-bold">{session.name}</span>
        {detail && <span className="block truncate text-sm text-muted">{detail}</span>}
      </span>
      <span className="text-sm font-bold">Start ›</span>
    </button>
  )
}
