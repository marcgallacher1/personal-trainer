import { useRef, useState } from 'react'
import { ChoiceDialog } from '../../components/ChoiceDialog'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/Toast'
import { describeTarget } from '../../lib/plans/targets'
import { describeTarget as describeGoal, todaysTarget } from '../../lib/adaptive/progression'
import { resetFor, usePlanChanges } from '../coach/data'
import { ExerciseList } from '../exercises/ExerciseList'
import { removeFromPlan, swapExercise, usePlanExercise, usePlanTargets } from '../plans/data'
import {
  asLogged,
  useExerciseHistory,
  useExercises,
  type Exercise,
  type SessionExercise,
  type SetRow,
} from '../../db/queries'
import { describePR } from '../../lib/logging/pr'
import { nextDraft, previousPerformance } from '../../lib/logging/previous'
import {
  asLogType,
  columnHeadings,
  formatEffort,
  formatLoad,
  formatSet,
} from '../../lib/logging/logTypes'
import { setNumbers } from '../../lib/logging/numbering'
import { isTimed, type SetType } from '../../lib/logging/types'
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

interface Props {
  se: SessionExercise
  exercise: Exercise | undefined
  sets: SetRow[]
  onClose: () => void
}

/** Full-screen modal for logging one exercise. */
export function ExerciseLogger({ se, exercise, sets, onClose }: Props) {
  const history = useExerciseHistory(se.exercise_id)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  /** The set just logged, so we can highlight it and confirm what happened. */
  const [justLogged, setJustLogged] = useState<{ id: string; text: string } | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const logged = sets.map(asLogged)
  const previous = history ? previousPerformance(history.map(asLogged), se.session_id) : null
  // Starts blank; later sets copy the last one. Last time's numbers are only shown.
  const draft = nextDraft(null, logged)
  const numbers = setNumbers(logged.map((s) => s.set_type))
  const nextNumber = numbers.filter(Boolean).length + 1
  const editing = sets.find((s) => s.id === editingSetId)
  const logType = asLogType(exercise?.log_type)
  const timed = isTimed(logType)
  const heads = columnHeadings(logType)
  // Timed sets have no RIR column
  const cols = timed ? 'grid-cols-[4.5rem_1fr_1fr]' : 'grid-cols-[4.5rem_1fr_1fr_3.5rem]'

  // Plan targets (hint only — values still start blank / copy the last set)
  const targets = usePlanTargets(se.plan_exercise_id) ?? []
  const planExercise = usePlanExercise(se.plan_exercise_id)
  const nextTarget = targets[sets.length]
  const library = useExercises()
  const [swapping, setSwapping] = useState(false)
  const [swapTo, setSwapTo] = useState<Exercise | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const alternatives = (planExercise?.alternatives ?? [])
    .map((id) => library?.find((e) => e.id === id))
    .filter((e): e is Exercise => Boolean(e))
  // Today's target (a hint; inputs still start blank)
  const planChanges = usePlanChanges()
  const plannedWorking = targets.filter((t) => t.set_type !== 'warmup')
  const goal = todaysTarget({
    last:
      previous?.sets.map((s) => ({
        weightKg: Number(s.weight_kg),
        reps: s.reps,
        rir: s.rir,
        setType: s.set_type,
      })) ?? null,
    repsMin: plannedWorking[0]?.reps_min ?? null,
    repsMax: plannedWorking[0]?.reps_max ?? null,
    targetRir: plannedWorking[0]?.target_rir ?? null,
    isCompound: exercise?.is_compound ?? false,
    logType,
    resetKg: resetFor(planChanges, se.exercise_id, previous?.date ?? null),
  })

  const nextInitial: EditorValue = {
    ...draft,
    // Follow the plan's set type (e.g. a planned warm-up) when there is one
    set_type: (nextTarget?.set_type as SetType | undefined) ?? draft.set_type,
    rir: null,
  }

  async function submitNew(v: EditorValue, close: boolean) {
    const { id, prs } = await logSet(se, v, v.rir, logType, nextTarget?.id ?? null)
    const label = v.set_type === 'warmup' ? 'Warm-up' : `Set ${nextNumber}`
    const text = `${label} logged · ${formatSet(v, logType)}`
    if (prs[0]) showToast({ message: describePR(prs[0]), tone: 'celebrate' })
    if (close) {
      if (!prs[0]) showToast({ message: `✓ ${text}` })
      onClose()
    } else {
      setJustLogged({ id, text })
      // Back to the top so the logged-sets table and confirmation are in view
      bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function remove(alsoFromPlan: boolean) {
    setConfirmRemove(false)
    const changes = await removeSessionExercise(se)
    if (alsoFromPlan && se.plan_exercise_id) {
      await removeFromPlan(se.plan_exercise_id, exercise?.name ?? 'exercise')
    }
    onClose()
    showToast({
      message: alsoFromPlan
        ? `Removed ${exercise?.name ?? 'exercise'} from today and the plan`
        : `Removed ${exercise?.name ?? 'exercise'}`,
      action: alsoFromPlan
        ? undefined
        : { label: 'Undo', onClick: () => void undoDeletion(changes) },
    })
  }

  async function swap(to: Exercise, alsoInPlan: boolean) {
    setSwapTo(null)
    setSwapping(false)
    await swapExercise(se, to, alsoInPlan)
    showToast({
      message: alsoInPlan ? `Swapped to ${to.name} in the plan too` : `Swapped to ${to.name}`,
    })
  }

  function pickSwap(to: Exercise) {
    if (se.plan_exercise_id) setSwapTo(to)
    else void swap(to, false)
  }

  return (
    <Sheet
      open
      bodyRef={bodyRef}
      title={exercise?.name ?? 'Exercise'}
      subtitle={
        previous
          ? `Last time (${shortDate(previous.date)}): ${previous.sets
              .map((s) => formatSet(s, logType))
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
        {goal && (
          <section className="flex gap-3 rounded-2xl bg-accent/10 p-4">
            <span className="text-2xl">🎯</span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold tracking-wide text-accent uppercase">
                Today’s target
              </span>
              <span className="block text-lg font-bold tabular-nums">
                {describeGoal(goal)}
                {goal.heavier && ' ⬆️'}
              </span>
              <span className="block text-sm text-muted">{goal.why}</span>
            </span>
          </section>
        )}

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
              <div
                className={`grid ${cols} gap-2 border-b border-border px-4 py-2 text-xs font-semibold tracking-wide text-muted uppercase`}
              >
                <span>Set</span>
                <span>{heads.load}</span>
                <span>{heads.effort}</span>
                {!timed && <span className="text-right">RIR</span>}
              </div>
              {sets.map((s, i) => {
                const type = s.set_type as SetType
                const info = SET_TYPE_INFO[type]
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setEditingSetId(s.id)}
                    className={`grid h-14 w-full ${cols} items-center gap-2 px-4 text-left active:bg-surface-2 ${
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
                    <span className="truncate text-lg font-semibold tabular-nums">
                      {formatLoad(s, logType)}
                    </span>
                    <span className="text-lg font-semibold tabular-nums">
                      {formatEffort(s, logType)}
                      {s.is_pr && (
                        <span className="ml-2" aria-label="Personal best">
                          🏆
                        </span>
                      )}
                    </span>
                    {!timed && (
                      <span className="text-right text-muted tabular-nums">
                        {s.rir === null ? '–' : s.rir === 4 ? '4+' : s.rir}
                      </span>
                    )}
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
            logType={logType}
            heading={`Edit set ${numbers[sets.indexOf(editing)] || ''}`.trim()}
            initial={{
              weight_kg: editing.weight_kg,
              reps: editing.reps,
              duration_seconds: editing.duration_seconds,
              set_type: editing.set_type as SetType,
              rir: editing.rir,
            }}
            submitLabel="Save changes"
            onCancel={() => setEditingSetId(null)}
            onSubmit={(v) => {
              void updateSet(editing, {
                weight_kg: v.weight_kg,
                reps: v.reps,
                duration_seconds: v.duration_seconds,
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
            key={`next-${sets.length}-${nextTarget?.id ?? 'none'}`}
            logType={logType}
            heading={
              nextInitial.set_type === 'warmup' ? 'Next: warm-up set' : `Next: set ${nextNumber}`
            }
            target={nextTarget ? describeTarget(nextTarget, logType) : undefined}
            initial={nextInitial}
            submitLabel={
              nextInitial.set_type === 'warmup' ? 'Log warm-up' : `Log set ${nextNumber}`
            }
            onSubmit={(v) => void submitNew(v, false)}
            secondaryLabel="Log & close"
            onSecondary={(v) => void submitNew(v, true)}
          />
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

        <div className={`grid gap-2 ${sets.length === 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {sets.length === 0 && (
            <button
              type="button"
              onClick={() => setSwapping(true)}
              className="h-12 rounded-xl bg-surface font-semibold"
            >
              Swap exercise
            </button>
          )}
          <button
            type="button"
            onClick={() => (se.plan_exercise_id ? setConfirmRemove(true) : void remove(false))}
            className="h-12 rounded-xl bg-surface font-semibold text-danger"
          >
            Remove
          </button>
        </div>
      </div>

      <Sheet
        open={swapping}
        title="Swap exercise"
        subtitle="Kit taken? Pick something else for today."
        closeLabel="Cancel"
        onClose={() => setSwapping(false)}
      >
        {alternatives.length > 0 && (
          <section className="mb-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
              Suggested swaps
            </h3>
            <div className="flex flex-col gap-2">
              {alternatives.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => pickSwap(a)}
                  className="h-14 rounded-xl bg-accent/15 px-4 text-left font-semibold"
                >
                  {a.name}
                </button>
              ))}
            </div>
          </section>
        )}
        <ExerciseList recentFirst onPick={pickSwap} />
      </Sheet>

      <ChoiceDialog
        open={swapTo !== null}
        title={`Swap to ${swapTo?.name}?`}
        choices={[
          {
            label: 'Just for today',
            description: 'The plan stays the same.',
            tone: 'primary',
            onSelect: () => swapTo && void swap(swapTo, false),
          },
          {
            label: 'Today and in the plan',
            description: `${exercise?.name ?? 'The old exercise'} becomes a swap option.`,
            onSelect: () => swapTo && void swap(swapTo, true),
          },
        ]}
        onCancel={() => setSwapTo(null)}
      />

      <ChoiceDialog
        open={confirmRemove}
        title={`Remove ${exercise?.name ?? 'exercise'}?`}
        choices={[
          {
            label: 'Remove from today only',
            description: 'It stays in your plan for next time.',
            tone: 'primary',
            onSelect: () => void remove(false),
          },
          {
            label: 'Remove from today and the plan',
            tone: 'danger',
            onSelect: () => void remove(true),
          },
        ]}
        onCancel={() => setConfirmRemove(false)}
      />
    </Sheet>
  )
}
