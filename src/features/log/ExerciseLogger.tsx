import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/Toast'
import {
  asLogged,
  useExerciseHistory,
  type Exercise,
  type SessionExercise,
  type SetRow,
} from '../../db/queries'
import { describePR } from '../../lib/logging/pr'
import { nextDraft, previousPerformance, remainingDrafts } from '../../lib/logging/previous'
import type { SetType } from '../../lib/logging/types'
import {
  deleteSet,
  logSet,
  removeSessionExercise,
  undoDeletion,
  updateSessionExercise,
  updateSet,
} from './actions'
import { SET_TYPE_INFO, SetEditor, type EditorValue } from './SetEditor'

export const kg = (n: number) => `${Math.round(n * 100) / 100}`
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso))

/** Working/drop/failure sets are numbered 1, 2, 3…; warm-ups aren't. */
export function setNumbers(types: readonly string[]): number[] {
  let n = 0
  return types.map((t) => (t === 'warmup' ? 0 : ++n))
}

interface Props {
  se: SessionExercise
  exercise: Exercise | undefined
  sets: SetRow[]
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (dir: -1 | 1) => void
  onClose: () => void
}

/** Full-screen modal for logging one exercise. */
export function ExerciseLogger({
  se,
  exercise,
  sets,
  canMoveUp,
  canMoveDown,
  onMove,
  onClose,
}: Props) {
  const history = useExerciseHistory(se.exercise_id)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  /** The set just logged, so we can highlight it and confirm what happened. */
  const [justLogged, setJustLogged] = useState<{ id: string; text: string } | null>(null)

  const logged = sets.map(asLogged)
  const previous = history ? previousPerformance(history.map(asLogged), se.session_id) : null
  const drafts = remainingDrafts(previous, logged)
  const draft = drafts[0] ?? nextDraft(previous, logged)
  const numbers = setNumbers(logged.map((s) => s.set_type))
  const nextNumber = numbers.filter(Boolean).length + 1
  const editing = sets.find((s) => s.id === editingSetId)

  async function submitNew(v: EditorValue, close: boolean) {
    const { id, prs } = await logSet(se, v, v.rir)
    const label = v.set_type === 'warmup' ? 'Warm-up' : `Set ${nextNumber}`
    const text = `${label} logged · ${kg(v.weight_kg)} kg × ${v.reps}`
    if (prs[0]) showToast({ message: describePR(prs[0]), tone: 'celebrate' })
    if (close) {
      if (!prs[0]) showToast({ message: `✓ ${text}` })
      onClose()
    } else {
      setJustLogged({ id, text })
    }
  }

  async function remove() {
    const changes = await removeSessionExercise(se)
    onClose()
    showToast({
      message: `Removed ${exercise?.name ?? 'exercise'}`,
      action: { label: 'Undo', onClick: () => void undoDeletion(changes) },
    })
  }

  return (
    <Sheet
      open
      title={exercise?.name ?? 'Exercise'}
      subtitle={
        previous
          ? `Last time (${shortDate(previous.date)}): ${previous.sets
              .map((s) => `${kg(s.weight_kg)} kg × ${s.reps}`)
              .join(', ')}`
          : 'First time logging this exercise'
      }
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="h-14 w-full rounded-2xl bg-surface-2 text-lg font-semibold"
        >
          Done · back to workout
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Logged sets */}
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Logged today
          </h3>
          {sets.length === 0 ? (
            <p className="rounded-2xl bg-surface p-4 text-center text-sm text-muted">
              No sets yet. Log your first set below.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-surface">
              <div className="grid grid-cols-[4.5rem_1fr_1fr_3.5rem] gap-2 border-b border-border px-4 py-2 text-xs font-semibold tracking-wide text-muted uppercase">
                <span>Set</span>
                <span>Weight</span>
                <span>Reps</span>
                <span className="text-right">RIR</span>
              </div>
              {sets.map((s, i) => {
                const type = s.set_type as SetType
                const info = SET_TYPE_INFO[type]
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setEditingSetId(s.id)}
                    className={`grid h-14 w-full grid-cols-[4.5rem_1fr_1fr_3.5rem] items-center gap-2 px-4 text-left active:bg-surface-2 ${
                      editingSetId === s.id ? 'bg-accent/10' : ''
                    } ${justLogged?.id === s.id ? 'animate-[flash_1.8s_ease-out]' : ''} ${i > 0 ? 'border-t border-border' : ''}`}
                  >
                    <span>
                      {type === 'working' ? (
                        <span className="text-lg font-bold">{numbers[i]}</span>
                      ) : (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${info.pill}`}
                        >
                          {type === 'warmup' ? info.short : `${numbers[i]} ${info.short}`}
                        </span>
                      )}
                    </span>
                    <span className="text-lg font-semibold tabular-nums">
                      {kg(s.weight_kg)} <span className="text-sm font-normal text-muted">kg</span>
                    </span>
                    <span className="text-lg font-semibold tabular-nums">
                      {s.reps}
                      {s.is_pr && (
                        <span className="ml-2" aria-label="Personal record">
                          🏆
                        </span>
                      )}
                    </span>
                    <span className="text-right text-muted tabular-nums">
                      {s.rir === null ? '–' : s.rir === 4 ? '4+' : s.rir}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {sets.length > 0 && !editing && !justLogged && (
            <p className="mt-1.5 text-xs text-muted">Tap a set to edit or delete it.</p>
          )}
          {justLogged && !editing && (
            <p
              key={justLogged.id}
              role="status"
              className="mt-2 animate-[pop_300ms_ease-out] rounded-xl bg-success/15 px-3 py-2 text-sm font-semibold text-success"
            >
              ✓ {justLogged.text}. Next set is ready below.
            </p>
          )}
        </section>

        {/* Editor: edit an existing set, or log the next one */}
        {editing ? (
          <SetEditor
            key={editing.id}
            heading={`Edit set ${numbers[sets.indexOf(editing)] || ''}`.trim()}
            initial={{
              weight_kg: editing.weight_kg,
              reps: editing.reps,
              set_type: editing.set_type as SetType,
              rir: editing.rir,
            }}
            submitLabel="Save changes"
            onCancel={() => setEditingSetId(null)}
            onSubmit={(v) => {
              void updateSet(editing, {
                weight_kg: v.weight_kg,
                reps: v.reps,
                set_type: v.set_type,
                rir: v.rir,
              })
              setEditingSetId(null)
            }}
            onDelete={async () => {
              setEditingSetId(null)
              const changes = await deleteSet(editing)
              showToast({
                message: 'Set deleted',
                action: { label: 'Undo', onClick: () => void undoDeletion(changes) },
              })
            }}
          />
        ) : (
          <SetEditor
            // Re-initialise with the next prefilled values after each logged set
            key={`next-${sets.length}-${previous?.sessionId ?? 'none'}`}
            heading={draft.set_type === 'warmup' ? 'Next: warm-up set' : `Next: set ${nextNumber}`}
            initial={{ ...draft, rir: null }}
            submitLabel={draft.set_type === 'warmup' ? 'Log warm-up' : `Log set ${nextNumber}`}
            onSubmit={(v) => void submitNew(v, false)}
            secondaryLabel="Log & close"
            onSecondary={(v) => void submitNew(v, true)}
          />
        )}

        {drafts.length > 1 && !editing && (
          <p className="-mt-2 px-1 text-sm text-muted">
            Still to match from last time:{' '}
            {drafts
              .slice(1)
              .map((d) => `${kg(d.weight_kg)} kg × ${d.reps}`)
              .join(', ')}
          </p>
        )}

        {/* Notes */}
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Exercise notes
          </h3>
          <textarea
            defaultValue={se.notes ?? ''}
            placeholder="Seat height, grip, cues…"
            rows={2}
            className="w-full resize-none rounded-2xl bg-surface p-4 outline-none"
            onBlur={(e) => {
              const notes = e.target.value.trim() || null
              if (notes !== se.notes) void updateSessionExercise(se, { notes })
            }}
          />
        </section>

        {/* Exercise actions */}
        <section className="grid grid-cols-3 gap-2 text-sm">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
            className="h-12 rounded-xl bg-surface font-medium disabled:opacity-40"
          >
            ↑ Move up
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
            className="h-12 rounded-xl bg-surface font-medium disabled:opacity-40"
          >
            ↓ Move down
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            className="h-12 rounded-xl bg-surface font-medium text-danger"
          >
            Remove
          </button>
        </section>
      </div>
    </Sheet>
  )
}
