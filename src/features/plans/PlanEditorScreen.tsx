import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { Button } from '../../components/Button'
import { Confirm } from '../../components/Confirm'
import { showToast } from '../../components/Toast'
import { DAY_NAMES, weekOf } from '../../lib/plans/draft'
import {
  archivePlan,
  deletePlan,
  deletePlanSession,
  duplicatePlan,
  setPlanActive,
  snapshotIfChanged,
  updatePlan,
  usePlanRows,
} from './data'
import { ActiveToggle } from './PlanBuilderScreen'
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

/** A saved plan: its week, its workouts, and whether it's active. */
export function PlanEditorScreen() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const rows = usePlanRows(planId)
  const [menu, setMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
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

  const { plan, sessions, schedule } = rows
  const items = sessions.map((s) => ({
    id: s.id,
    title: s.name,
    weekdays: schedule
      .filter((d) => d.plan_session_id === s.id && d.weekday !== null)
      .map((d) => d.weekday!),
  }))
  const week = weekOf(items)
  const toRemove = sessions.find((s) => s.id === removing)

  return (
    <div className="flex flex-col gap-5">
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

      <ActiveToggle
        active={plan.is_active}
        onChange={(v) =>
          void setPlanActive(plan, v).then(() =>
            showToast({ message: v ? 'Plan is now active' : 'Plan switched off' }),
          )
        }
      />

      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Your week</h2>
        <ul className="divide-y divide-border rounded-2xl bg-surface">
          {week.map((d) => (
            <li key={d.weekday} className="flex items-center gap-3 px-4 py-3">
              <span className="w-10 shrink-0 font-bold">{DAY_NAMES[d.weekday - 1]}</span>
              <span className={`min-w-0 flex-1 truncate ${d.titles.length ? '' : 'text-muted'}`}>
                {d.titles.length ? d.titles.join(' + ') : 'Rest'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Workouts</h2>
        <ul className="flex flex-col gap-3">
          {sessions.map((s) => {
            const count = rows.exercises.filter((e) => e.plan_session_id === s.id).length
            return (
              <li key={s.id} className="rounded-2xl bg-surface">
                <button
                  type="button"
                  onClick={() => void navigate(`/plans/${plan.id}/sessions/${s.id}`)}
                  className="flex w-full items-start gap-3 p-4 text-left"
                >
                  <span className="text-2xl">{s.emoji ?? '🏋️'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold">{s.name}</span>
                    <span className="block text-sm text-muted">
                      {count} exercise{count === 1 ? '' : 's'} · tap to edit
                    </span>
                  </span>
                  <span className="text-2xl text-muted">›</span>
                </button>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  <WeekdayPicker planId={plan.id} sessionId={s.id} schedule={schedule} />
                  <button
                    type="button"
                    className="h-9 self-end text-sm font-semibold text-danger"
                    onClick={() => setRemoving(s.id)}
                  >
                    Remove from plan
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        {sessions.length === 0 && (
          <p className="rounded-2xl bg-surface p-6 text-center text-muted">No workouts yet.</p>
        )}
      </section>

      <Button variant="secondary" onClick={() => void navigate(`/plans/${plan.id}/add`)}>
        + Add workouts
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
        open={toRemove !== undefined}
        title={`Remove ${toRemove?.name ?? 'workout'} from ${plan.name}?`}
        body="Workouts you’ve already logged are kept."
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          const s = toRemove
          setRemoving(null)
          if (!s) return
          await deletePlanSession(s)
          showToast({ message: `${s.name} removed` })
        }}
      />

      <Confirm
        open={confirmDelete}
        title={`Delete ${plan.name}?`}
        body="Workouts you’ve already logged are kept."
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
