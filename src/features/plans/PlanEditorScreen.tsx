import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../../components/Button'
import { Confirm } from '../../components/Confirm'
import { showToast } from '../../components/Toast'
import type { PlanRows, PlanScheduleRow, PlanSessionRow } from '../../lib/plans/instantiate'
import {
  activatePlan,
  addPlanSession,
  archivePlan,
  deletePlan,
  duplicatePlan,
  snapshotIfChanged,
  swapOrder,
  toggleWeekday,
  updatePlan,
  usePlanRows,
} from './data'

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Saves a version when you leave a plan screen, if anything changed. */
export function useSnapshotOnLeave(planId: string | undefined) {
  useEffect(() => {
    if (!planId) return
    return () => {
      void snapshotIfChanged(planId, 'Edited')
    }
  }, [planId])
}

export function PlanEditorScreen() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const rows = usePlanRows(planId)
  const [reordering, setReordering] = useState(false)
  const [menu, setMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  useSnapshotOnLeave(planId)

  if (rows === undefined) return null
  if (rows === null || rows.plan.deleted_at) {
    return (
      <p className="py-12 text-center text-muted">
        Plan not found.{' '}
        <Link to="/plans" className="text-accent">
          Back to plans
        </Link>
      </p>
    )
  }

  const { plan, sessions } = rows
  const weekdayMode = plan.schedule_mode === 'weekday'

  return (
    <div className="flex flex-col gap-4">
      <Link to="/plans" className="text-sm text-accent">
        ‹ Plans
      </Link>
      <div>
        <input
          key={plan.id}
          defaultValue={plan.name}
          aria-label="Plan name"
          className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none"
          onBlur={(e) => {
            const name = e.target.value.trim()
            if (name && name !== plan.name) void updatePlan(plan, { name })
          }}
        />
        {plan.is_active ? (
          <p className="text-sm font-semibold text-accent">Active plan · shown on Today</p>
        ) : (
          <button
            type="button"
            className="mt-1 h-10 rounded-full bg-accent px-4 text-sm font-bold text-accent-fg"
            onClick={() =>
              void activatePlan(plan).then(() => showToast({ message: 'Plan activated' }))
            }
          >
            Make this my active plan
          </button>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Schedule</h2>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
          {(['rotation', 'weekday'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={plan.schedule_mode === mode}
              onClick={() => void updatePlan(plan, { schedule_mode: mode })}
              className={`h-11 rounded-lg text-sm font-semibold ${
                plan.schedule_mode === mode ? 'bg-bg shadow-sm' : 'text-muted'
              }`}
            >
              {mode === 'rotation' ? 'Rotation' : 'Fixed weekdays'}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">
          {weekdayMode
            ? 'Pick which days each session falls on. Today shows the session(s) for today.'
            : 'Sessions run in order, on whichever days you train. Today shows what’s next.'}
        </p>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
            Sessions {weekdayMode ? '' : '(in rotation order)'}
          </h2>
          {sessions.length > 1 && (
            <button
              type="button"
              className="h-8 px-3 text-sm font-semibold text-accent"
              onClick={() => setReordering((r) => !r)}
            >
              {reordering ? 'Done' : 'Reorder'}
            </button>
          )}
        </div>
        <ul className="flex flex-col gap-2">
          {sessions.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <SessionCard
                  rows={rows}
                  session={s}
                  weekdayMode={weekdayMode}
                  onOpen={() => {
                    if (!reordering) void navigate(`/plans/${plan.id}/sessions/${s.id}`)
                  }}
                />
              </div>
              {reordering && (
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => void swapOrder('plan_sessions', sessions, i, -1)}
                    className="h-9 w-11 rounded-lg bg-surface text-lg disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={i === sessions.length - 1}
                    onClick={() => void swapOrder('plan_sessions', sessions, i, 1)}
                    className="h-9 w-11 rounded-lg bg-surface text-lg disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <Button
        variant="secondary"
        onClick={async () => {
          const letter = String.fromCharCode(65 + sessions.length)
          const id = await addPlanSession(plan.id, `Session ${letter}`)
          void navigate(`/plans/${plan.id}/sessions/${id}`)
        }}
      >
        + Add session
      </Button>

      <button
        type="button"
        className="h-11 text-sm font-semibold text-muted"
        onClick={() => setMenu((m) => !m)}
      >
        {menu ? 'Hide options' : 'More options…'}
      </button>
      {menu && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Link
            to={`/plans/${plan.id}/history`}
            className="flex h-12 items-center justify-center rounded-xl bg-surface font-semibold"
          >
            Version history
          </Link>
          <button
            type="button"
            className="h-12 rounded-xl bg-surface font-semibold"
            onClick={async () => {
              const id = await duplicatePlan(plan)
              showToast({ message: 'Plan duplicated' })
              void navigate(`/plans/${id}`)
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="h-12 rounded-xl bg-surface font-semibold"
            onClick={() => void archivePlan(plan, !plan.archived)}
          >
            {plan.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button
            type="button"
            className="h-12 rounded-xl bg-surface font-semibold text-danger"
            onClick={() => setConfirmDelete(true)}
          >
            Delete plan
          </button>
        </div>
      )}

      <Confirm
        open={confirmDelete}
        title={`Delete ${plan.name}?`}
        body="Workouts you've already logged are kept."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false)
          await deletePlan(plan)
          showToast({ message: 'Plan deleted' })
          void navigate('/plans')
        }}
      />
    </div>
  )
}

function SessionCard({
  rows,
  session,
  weekdayMode,
  onOpen,
}: {
  rows: PlanRows
  session: PlanSessionRow
  weekdayMode: boolean
  onOpen: () => void
}) {
  const exercises = rows.exercises.filter((e) => e.plan_session_id === session.id)
  const ids = new Set(exercises.map((e) => e.id))
  const sets = rows.targets.filter((t) => ids.has(t.plan_exercise_id) && t.set_type !== 'warmup')
  return (
    <div className="rounded-2xl bg-surface">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="text-2xl">{session.emoji ?? '🏋️'}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-bold">{session.name}</span>
          <span className="block text-sm text-muted">
            {exercises.length} exercises · {sets.length} sets
          </span>
        </span>
        <span className="text-2xl text-muted">›</span>
      </button>
      {weekdayMode && (
        <WeekdayPicker planId={rows.plan.id} sessionId={session.id} schedule={rows.schedule} />
      )}
    </div>
  )
}

export function WeekdayPicker({
  planId,
  sessionId,
  schedule,
}: {
  planId: string
  sessionId: string
  schedule: PlanScheduleRow[]
}) {
  return (
    <div className="grid grid-cols-7 gap-1 px-3 pb-3">
      {WEEKDAYS.map((d, i) => {
        const on = schedule.some((s) => s.plan_session_id === sessionId && s.weekday === i + 1)
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => void toggleWeekday(planId, sessionId, i + 1, schedule)}
            className={`h-9 rounded-lg text-xs font-semibold ${on ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted'}`}
          >
            {d}
          </button>
        )
      })}
    </div>
  )
}
