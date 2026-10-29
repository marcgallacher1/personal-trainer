import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { Button } from '../../components/Button'
import { Confirm } from '../../components/Confirm'
import { showToast } from '../../components/Toast'
import { versionTitle } from '../../lib/plans/templates'
import {
  addVersion,
  archivePlan,
  deletePlan,
  duplicatePlan,
  snapshotIfChanged,
  swapOrder,
  updatePlan,
  usePlanRows,
} from './data'
import { WeekdayPicker } from './WeekdayPicker'

/** Saves a version when you leave a plan screen, if anything changed. */
export function useSnapshotOnLeave(planId: string | undefined) {
  useEffect(() => {
    if (!planId) return
    return () => {
      void snapshotIfChanged(planId, 'Edited')
    }
  }, [planId])
}

/** One plan (e.g. Push) and its versions A, B… */
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
      <div className="py-12 text-center">
        <p className="text-muted">This plan doesn’t exist any more.</p>
        <Link to="/plans" className="mt-4 inline-block font-semibold text-accent">
          Back to plans
        </Link>
      </div>
    )
  }

  const { plan, sessions } = rows

  return (
    <div className="flex flex-col gap-4">
      <BackButton fallback="/plans" label="Plans" />
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

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Versions</h2>
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
        <ul className="flex flex-col gap-3">
          {sessions.map((s, i) => {
            const exercises = rows.exercises.filter((e) => e.plan_session_id === s.id)
            const ids = new Set(exercises.map((e) => e.id))
            const sets = rows.targets.filter(
              (t) => ids.has(t.plan_exercise_id) && t.set_type !== 'warmup',
            ).length
            return (
              <li key={s.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1 rounded-2xl bg-surface">
                  <button
                    type="button"
                    onClick={() => {
                      if (!reordering) void navigate(`/plans/${plan.id}/sessions/${s.id}`)
                    }}
                    className="flex w-full items-start gap-3 p-4 text-left"
                  >
                    <span className="text-2xl">{s.emoji ?? '🏋️'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-bold">
                        {versionTitle(plan.name, s.name)}
                      </span>
                      {s.notes && (
                        <span className="line-clamp-2 block text-sm text-muted">{s.notes}</span>
                      )}
                      <span className="block text-xs text-muted">
                        {exercises.length} exercises · {sets} sets
                      </span>
                    </span>
                    <span className="text-2xl text-muted">›</span>
                  </button>
                  {!reordering && (
                    <div className="px-4 pb-4">
                      <WeekdayPicker planId={plan.id} sessionId={s.id} schedule={rows.schedule} />
                    </div>
                  )}
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
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Days are optional. Anything scheduled for today appears first when you tap Start plan.
        </p>
      </section>

      <Button
        variant="secondary"
        onClick={async () => {
          const id = await addVersion(plan.id)
          void navigate(`/plans/${plan.id}/sessions/${id}`)
        }}
      >
        + Add version
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
              void navigate(`/plans/${id}`, { replace: true })
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
          void navigate('/plans', { replace: true })
        }}
      />
    </div>
  )
}
