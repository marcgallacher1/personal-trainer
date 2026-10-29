import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Sheet } from '../../components/Sheet'
import { DAY_NAMES } from '../../lib/plans/draft'
import type { PlanSessionRow } from '../../lib/plans/instantiate'
import { isoWeekday } from '../../lib/plans/schedule'
import { startSession } from '../log/actions'
import { londonDate } from '../log/format'
import { startFromPlan, usePlanLibrary } from './data'

interface Props {
  open: boolean
  onClose: () => void
}

/** Pick a workout from your plans (active plan first, today's workout on top), or log freely. */
export function StartPlanSheet({ open, onClose }: Props) {
  const navigate = useNavigate()
  const library = usePlanLibrary()
  const [today] = useState(() => isoWeekday(londonDate(new Date().toISOString())))

  async function go(start: () => Promise<string>) {
    const id = await start()
    onClose()
    void navigate(`/log/session/${id}`)
  }

  const plans = (library ?? []).toSorted(
    (a, b) => Number(b.plan.is_active) - Number(a.plan.is_active),
  )
  const daysOf = (planIdx: number, s: PlanSessionRow) =>
    plans[planIdx]!.schedule.filter((d) => d.plan_session_id === s.id && d.weekday !== null)
      .map((d) => d.weekday!)
      .toSorted((a, b) => a - b)

  return (
    <Sheet open={open} title="Start a workout" closeLabel="Cancel" onClose={onClose}>
      <div className="flex flex-col gap-5">
        {plans.length === 0 && (
          <p className="rounded-2xl bg-surface p-4 text-center text-muted">
            You don’t have a plan yet — that’s fine.{' '}
            <Link to="/plans/new" onClick={onClose} className="font-semibold text-accent">
              Make one
            </Link>{' '}
            or start an empty workout below.
          </p>
        )}

        {plans.map((p, pi) => {
          const todays = p.plan.is_active
            ? p.versions.filter((s) => daysOf(pi, s).includes(today))
            : []
          return (
            <section key={p.plan.id}>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
                {p.plan.name}
                {p.plan.is_active && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-fg">
                    ACTIVE
                  </span>
                )}
              </h3>
              <div className="flex flex-col gap-2">
                {p.versions.map((s) => {
                  const days = daysOf(pi, s)
                  const isToday = todays.includes(s)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => void go(() => startFromPlan(s))}
                      className={`flex items-center gap-3 rounded-2xl p-4 text-left active:opacity-80 ${
                        isToday ? 'bg-accent text-accent-fg' : 'bg-surface'
                      }`}
                    >
                      <span className="text-2xl">{s.emoji ?? '🏋️'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-lg font-bold">{s.name}</span>
                        <span
                          className={`block truncate text-sm ${isToday ? 'opacity-80' : 'text-muted'}`}
                        >
                          {isToday
                            ? 'Today'
                            : days.length
                              ? days.map((d) => DAY_NAMES[d - 1]).join(', ')
                              : 'Any day'}
                        </span>
                      </span>
                      <span className="text-sm font-bold">Start ›</span>
                    </button>
                  )
                })}
                {p.versions.length === 0 && (
                  <p className="text-sm text-muted">No workouts in this plan yet.</p>
                )}
              </div>
            </section>
          )
        })}

        <button
          type="button"
          onClick={() => void go(startSession)}
          className="h-14 rounded-2xl border border-dashed border-border font-semibold text-muted"
        >
          Empty workout (no plan)
        </button>
      </div>
    </Sheet>
  )
}
