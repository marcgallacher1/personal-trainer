import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../../components/Button'
import { Confirm } from '../../components/Confirm'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/Toast'
import { useExercises, type Exercise } from '../../db/queries'
import { asLogType } from '../../lib/logging/logTypes'
import type { PlanExerciseRow } from '../../lib/plans/instantiate'
import { describeTargets } from '../../lib/plans/targets'
import { ExerciseList } from '../exercises/ExerciseList'
import {
  addPlanExercise,
  deletePlanSession,
  swapOrder,
  updatePlanSession,
  usePlanRows,
} from './data'
import { BackButton } from '../../components/BackButton'
import { useSnapshotOnLeave } from './PlanEditorScreen'
import { WeekdayPicker } from './WeekdayPicker'
import { PlanExerciseSheet } from './PlanExerciseSheet'

const EMOJIS = ['💪', '🦍', '🔥', '⚡', '🏋️', '🦵', '🍑', '🎯', '🅰️', '🅱️', '⭐', '🚀']

/** Letters for superset groups in display order: A, B, C… */
export function groupLabels(exercises: readonly PlanExerciseRow[]): Map<string, string> {
  const labels = new Map<string, string>()
  const counts = new Map<string, number>()
  for (const e of exercises) {
    if (!e.group_id) continue
    if (!counts.has(e.group_id)) counts.set(e.group_id, 0)
    const groupLetter = String.fromCharCode(65 + [...counts.keys()].indexOf(e.group_id))
    counts.set(e.group_id, counts.get(e.group_id)! + 1)
    labels.set(e.id, `${groupLetter}${counts.get(e.group_id)}`)
  }
  return labels
}

export function PlanSessionScreen() {
  const { planId, sessionId } = useParams()
  const navigate = useNavigate()
  const rows = usePlanRows(planId)
  const library = useExercises()
  const [picking, setPicking] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  useSnapshotOnLeave(planId)

  const session = rows?.sessions.find((s) => s.id === sessionId)
  if (rows === undefined) return null
  if (!rows || !session) {
    return (
      <p className="py-12 text-center text-muted">
        Session not found.{' '}
        <Link to={`/plans/${planId}`} className="text-accent">
          Back
        </Link>
      </p>
    )
  }

  const byId = new Map((library ?? []).map((e) => [e.id, e]))
  const exercises = rows.exercises.filter((e) => e.plan_session_id === session.id)
  const labels = groupLabels(exercises)
  const open = exercises.find((e) => e.id === openId)
  const openIndex = open ? exercises.indexOf(open) : -1

  async function add(e: Exercise) {
    setPicking(false)
    const id = await addPlanExercise(session!.id, e, asLogType(e.log_type))
    setOpenId(id)
  }

  return (
    <div className="flex flex-col gap-4">
      <BackButton fallback={`/plans/${rows.plan.id}`} label={rows.plan.name} />

      <div className="flex items-center gap-3">
        <EmojiButton
          value={session.emoji}
          onChange={(emoji) => void updatePlanSession(session, { emoji })}
        />
        <input
          key={session.id}
          defaultValue={session.name}
          aria-label="Workout name"
          className="min-w-0 flex-1 bg-transparent text-3xl font-bold tracking-tight outline-none"
          onBlur={(e) => {
            const name = e.target.value.trim()
            if (name && name !== session.name) void updatePlanSession(session, { name })
          }}
        />
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
          Description
        </h2>
        <textarea
          key={`notes-${session.id}`}
          defaultValue={session.notes ?? ''}
          placeholder="What this workout focuses on, e.g. heavier chest, more side delts…"
          rows={2}
          className="w-full resize-none rounded-2xl bg-surface p-4 outline-none"
          onBlur={(e) => {
            const notes = e.target.value.trim() || null
            if (notes !== session.notes) void updatePlanSession(session, { notes })
          }}
        />
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Days</h2>
        <WeekdayPicker planId={rows.plan.id} sessionId={session.id} schedule={rows.schedule} />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Exercises</h2>
          {exercises.length > 1 && (
            <button
              type="button"
              className="h-8 px-3 text-sm font-semibold text-accent"
              onClick={() => setReordering((r) => !r)}
            >
              {reordering ? 'Done' : 'Reorder'}
            </button>
          )}
        </div>
        {exercises.length === 0 && (
          <p className="rounded-2xl bg-surface p-6 text-center text-muted">No exercises yet.</p>
        )}
        <ul className="flex flex-col gap-2">
          {exercises.map((pe, i) => {
            const ex = byId.get(pe.exercise_id)
            const targets = rows.targets.filter((t) => t.plan_exercise_id === pe.id)
            const label = labels.get(pe.id)
            return (
              <li key={pe.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!reordering) setOpenId(pe.id)
                  }}
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-surface p-4 text-left ${
                    label ? 'border-l-4 border-accent' : ''
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold">
                      {label && (
                        <span className="mr-2 rounded-md bg-accent/20 px-1.5 py-0.5 text-xs font-bold text-accent">
                          {label}
                        </span>
                      )}
                      {ex?.name ?? 'Unknown exercise'}
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {describeTargets(targets, asLogType(ex?.log_type))}
                    </span>
                  </span>
                  <span className="text-2xl text-muted">›</span>
                </button>
                {reordering && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={i === 0}
                      onClick={() => void swapOrder('plan_exercises', exercises, i, -1)}
                      className="h-9 w-11 rounded-lg bg-surface text-lg disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={i === exercises.length - 1}
                      onClick={() => void swapOrder('plan_exercises', exercises, i, 1)}
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
        {labels.size > 0 && (
          <p className="mt-2 text-xs text-muted">
            Matching letters (A1, A2…) are supersets: do them back to back, then rest.
          </p>
        )}
      </section>

      <Button variant="secondary" onClick={() => setPicking(true)}>
        + Add exercise
      </Button>

      <button type="button" className="h-12 text-danger" onClick={() => setConfirmDelete(true)}>
        Remove from plan
      </button>

      <Sheet
        open={picking}
        title="Add exercise"
        subtitle="Starts with sensible targets you can change."
        closeLabel="Cancel"
        onClose={() => setPicking(false)}
      >
        <ExerciseList
          recentFirst
          added={new Set(exercises.map((e) => e.exercise_id))}
          onPick={(e) => void add(e)}
        />
      </Sheet>

      {open && (
        <PlanExerciseSheet
          key={open.id}
          pe={open}
          exercise={byId.get(open.exercise_id)}
          list={exercises}
          index={openIndex}
          targets={rows.targets.filter((t) => t.plan_exercise_id === open.id)}
          onClose={() => setOpenId(null)}
        />
      )}

      <Confirm
        open={confirmDelete}
        title={`Remove ${session.name} from ${rows.plan.name}?`}
        body="Its exercises and targets are removed from the plan. Logged workouts are kept."
        confirmLabel="Remove"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false)
          await deletePlanSession(session)
          showToast({ message: `${session.name} removed` })
          void navigate(`/plans/${rows.plan.id}`, { replace: true })
        }}
      />
    </div>
  )
}

function EmojiButton({ value, onChange }: { value: string | null; onChange: (e: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Change emoji"
        onClick={() => setOpen((o) => !o)}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-3xl"
      >
        {value ?? '🏋️'}
      </button>
      {open && (
        <div className="absolute top-16 left-0 z-30 grid w-64 grid-cols-6 gap-1 rounded-2xl bg-surface p-2 shadow-xl">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className="h-10 rounded-lg text-2xl active:bg-surface-2"
              onClick={() => {
                onChange(e)
                setOpen(false)
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
