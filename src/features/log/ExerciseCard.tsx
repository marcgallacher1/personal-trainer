import { useState } from 'react'
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
import { SET_TYPE_BADGE, SetEditor, type EditorValue } from './SetEditor'

interface Props {
  se: SessionExercise
  exercise: Exercise | undefined
  sets: SetRow[]
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (dir: -1 | 1) => void
}

const kg = (n: number) => `${Math.round(n * 100) / 100}`
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso))

/** Number shown in a set's badge: working/drop/failure sets are numbered, warm-ups show W. */
function setNumbers(types: SetType[]): number[] {
  let n = 0
  return types.map((t) => (t === 'warmup' ? 0 : ++n))
}

export function ExerciseCard({ se, exercise, sets, canMoveUp, canMoveDown, onMove }: Props) {
  const history = useExerciseHistory(se.exercise_id)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [extraDraft, setExtraDraft] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(Boolean(se.notes))

  const logged = sets.map(asLogged)
  const previous = history ? previousPerformance(history.map(asLogged), se.session_id) : null
  const drafts = remainingDrafts(previous, logged)
  // No history: keep an open editor. With history: prefill until you have matched last time, then "+ Add set".
  const showEditor = drafts.length > 0 || extraDraft || !previous
  const draft = drafts[0] ?? nextDraft(previous, logged)
  const numbers = setNumbers(logged.map((s) => s.set_type))
  const nextNumber = logged.filter((s) => s.set_type !== 'warmup').length + 1

  async function submit(v: EditorValue) {
    const prs = await logSet(se, v, v.rir)
    setExtraDraft(false)
    if (prs[0]) showToast({ message: describePR(prs[0]), tone: 'celebrate' })
  }

  async function remove() {
    setMenuOpen(false)
    const changes = await removeSessionExercise(se)
    showToast({
      message: `Removed ${exercise?.name ?? 'exercise'}`,
      action: { label: 'Undo', onClick: () => void undoDeletion(changes) },
    })
  }

  return (
    <section className="rounded-3xl bg-surface p-3">
      <header className="flex items-start gap-2 px-1">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold">{exercise?.name ?? 'Unknown exercise'}</h3>
          <p className="text-xs text-muted">
            {previous
              ? `Last (${shortDate(previous.date)}): ${previous.sets
                  .map((s) => `${s.set_type === 'warmup' ? 'W ' : ''}${kg(s.weight_kg)}×${s.reps}`)
                  .join(' · ')}`
              : 'First time logging this exercise'}
          </p>
        </div>
        <button
          type="button"
          aria-label="Exercise options"
          className="h-10 w-10 shrink-0 rounded-full text-xl text-muted active:bg-surface-2"
          onClick={() => setMenuOpen((o) => !o)}
        >
          ⋯
        </button>
      </header>

      {menuOpen && (
        <div className="mt-2 grid grid-cols-2 gap-2 px-1 text-sm">
          <MenuButton disabled={!canMoveUp} onClick={() => (onMove(-1), setMenuOpen(false))}>
            ↑ Move up
          </MenuButton>
          <MenuButton disabled={!canMoveDown} onClick={() => (onMove(1), setMenuOpen(false))}>
            ↓ Move down
          </MenuButton>
          <MenuButton onClick={() => (setNotesOpen(true), setMenuOpen(false))}>✎ Notes</MenuButton>
          <MenuButton danger onClick={() => void remove()}>
            Remove
          </MenuButton>
        </div>
      )}

      {notesOpen && (
        <textarea
          defaultValue={se.notes ?? ''}
          placeholder="Notes for this exercise (seat height, cues…)"
          rows={2}
          className="mt-2 w-full resize-none rounded-xl bg-surface-2 p-3 text-sm outline-none"
          onBlur={(e) => {
            const notes = e.target.value.trim() || null
            if (notes !== se.notes) void updateSessionExercise(se, { notes })
          }}
        />
      )}

      <ol className="mt-2 flex flex-col gap-1.5">
        {sets.map((s, i) =>
          editingSetId === s.id ? (
            <li key={s.id}>
              <SetEditor
                initial={{
                  weight_kg: s.weight_kg,
                  reps: s.reps,
                  set_type: s.set_type as SetType,
                  rir: s.rir,
                }}
                setNumber={numbers[i] || i + 1}
                submitLabel="Save"
                onSubmit={(v) => {
                  void updateSet(s, {
                    weight_kg: v.weight_kg,
                    reps: v.reps,
                    set_type: v.set_type,
                    rir: v.rir,
                  })
                  setEditingSetId(null)
                }}
                onCancel={() => setEditingSetId(null)}
                onDelete={async () => {
                  setEditingSetId(null)
                  const changes = await deleteSet(s)
                  showToast({
                    message: 'Set deleted',
                    action: { label: 'Undo', onClick: () => void undoDeletion(changes) },
                  })
                }}
              />
            </li>
          ) : (
            <li key={s.id}>
              <LoggedSetRow
                set={s}
                number={numbers[i] || i + 1}
                onEdit={() => setEditingSetId(s.id)}
              />
            </li>
          ),
        )}

        {showEditor && editingSetId === null && (
          <li>
            <SetEditor
              // Re-initialise with the next prefilled values after each logged set
              key={`${sets.length}-${previous?.sessionId ?? 'none'}`}
              initial={{ ...draft, rir: null }}
              setNumber={nextNumber}
              submitLabel="✓"
              onSubmit={(v) => void submit(v)}
            />
          </li>
        )}
        {drafts.slice(1).map((d, i) => (
          <li key={`next-${i}`} className="flex h-9 items-center gap-3 px-2 text-sm text-muted">
            <span className="w-6 text-center">·</span>
            {kg(d.weight_kg)} kg × {d.reps}
          </li>
        ))}
      </ol>

      {!showEditor && editingSetId === null && (
        <button
          type="button"
          className="mt-2 h-11 w-full rounded-xl border border-dashed border-border text-sm font-semibold text-muted"
          onClick={() => setExtraDraft(true)}
        >
          + Add set
        </button>
      )}
    </section>
  )
}

function LoggedSetRow({
  set,
  number,
  onEdit,
}: {
  set: SetRow
  number: number
  onEdit: () => void
}) {
  const badge = SET_TYPE_BADGE[set.set_type as SetType]
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex h-12 w-full items-center gap-3 rounded-xl px-2 text-left active:bg-surface-2"
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${badge.className}`}
      >
        {badge.short || number}
      </span>
      <span className="flex-1 text-lg font-semibold tabular-nums">
        {kg(set.weight_kg)}
        <span className="text-sm font-normal text-muted"> kg</span> × {set.reps}
      </span>
      {set.rir !== null && (
        <span className="text-sm text-muted">RIR {set.rir === 4 ? '4+' : set.rir}</span>
      )}
      {set.is_pr && <span aria-label="Personal record">🏆</span>}
      <span className="text-success">✓</span>
    </button>
  )
}

function MenuButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-11 rounded-xl bg-surface-2 font-medium disabled:opacity-40 ${danger ? 'text-danger' : ''}`}
    >
      {children}
    </button>
  )
}
