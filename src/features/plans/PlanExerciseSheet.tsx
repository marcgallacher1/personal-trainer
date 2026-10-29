import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { Stepper } from '../../components/Stepper'
import { showToast } from '../../components/Toast'
import { useExercises, type Exercise } from '../../db/queries'
import { asLogType } from '../../lib/logging/logTypes'
import { formatSeconds } from '../../lib/logging/pr'
import { isTimed, type SetType } from '../../lib/logging/types'
import type { PlanExerciseRow, PlanSetTargetRow } from '../../lib/plans/instantiate'
import { describeTarget, quickSets, type TargetLike } from '../../lib/plans/targets'
import { ExerciseList } from '../exercises/ExerciseList'
import { SET_TYPE_INFO } from '../log/SetEditor'
import {
  linkWithNext,
  removePlanExercise,
  setTargets,
  unlinkGroup,
  updatePlanExercise,
} from './data'

const PROGRESSION: { id: string; name: string; hint: string }[] = [
  {
    id: 'double',
    name: 'Double progression',
    hint: 'Hit the top of the rep range on every set, then add weight.',
  },
  { id: 'linear', name: 'Linear', hint: 'Add a little weight every session.' },
  { id: 'rpe', name: 'By effort (RIR)', hint: 'Adjust weight to land on the target RIR.' },
  { id: 'fixed_pct', name: 'Fixed %', hint: 'Weight as a % of your estimated 1RM.' },
  { id: 'none', name: 'Manual', hint: 'No suggestions — you decide.' },
]

const RIR_CHOICES: (number | null)[] = [null, 0, 1, 2, 3]
const TYPES: SetType[] = ['working', 'warmup', 'drop', 'failure']

const plain = (t: PlanSetTargetRow): TargetLike => ({
  set_type: t.set_type,
  reps_min: t.reps_min,
  reps_max: t.reps_max,
  seconds_min: t.seconds_min,
  seconds_max: t.seconds_max,
  target_rir: t.target_rir,
})

interface Props {
  pe: PlanExerciseRow
  exercise: Exercise | undefined
  list: PlanExerciseRow[]
  index: number
  targets: PlanSetTargetRow[]
  onClose: () => void
}

/** Edit one planned exercise: per-set targets, progression, swap options, supersets. */
export function PlanExerciseSheet({ pe, exercise, list, index, targets, onClose }: Props) {
  const logType = asLogType(exercise?.log_type)
  const timed = isTimed(logType)
  const library = useExercises()
  const [pickingAlt, setPickingAlt] = useState(false)

  const working = targets.filter((t) => t.set_type !== 'warmup')
  const first = working[0] ?? targets[0]
  const [quick, setQuick] = useState({
    sets: working.length || 3,
    min: (timed ? first?.seconds_min : first?.reps_min) ?? (timed ? 30 : 8),
    max: (timed ? first?.seconds_max : first?.reps_max) ?? (timed ? 60 : 12),
    rir: first?.target_rir ?? (timed ? null : 1),
  })

  const write = (next: TargetLike[]) => void setTargets(pe, next)
  const editTarget = (i: number, patch: Partial<TargetLike>) =>
    write(targets.map((t, j) => (j === i ? { ...plain(t), ...patch } : plain(t))))

  const applyQuick = () => {
    const warmups = targets.filter((t) => t.set_type === 'warmup').map(plain)
    write([...warmups, ...quickSets(quick, logType)])
    showToast({ message: 'Targets updated' })
  }

  const names = new Map((library ?? []).map((e) => [e.id, e.name]))
  const groupMates = pe.group_id ? list.filter((e) => e.group_id === pe.group_id) : []
  const unit = timed ? 's' : 'reps'

  return (
    <Sheet
      open
      title={exercise?.name ?? 'Exercise'}
      subtitle="Targets for this exercise in the plan."
      onClose={onClose}
    >
      <div className="flex flex-col gap-6">
        {/* Quick setter */}
        <section className="rounded-3xl bg-surface p-4">
          <h3 className="mb-3 font-bold">Quick set-up</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Working sets">
              <Stepper
                label="sets"
                value={quick.sets}
                step={1}
                min={1}
                onChange={(sets) => setQuick({ ...quick, sets })}
              />
            </Field>
            <Field label="Reps in reserve">
              <div className="grid grid-cols-5 gap-1">
                {RIR_CHOICES.map((r) => (
                  <button
                    key={String(r)}
                    type="button"
                    disabled={timed}
                    aria-pressed={quick.rir === r}
                    onClick={() => setQuick({ ...quick, rir: r })}
                    className={`h-14 rounded-lg text-sm font-semibold disabled:opacity-30 ${
                      quick.rir === r ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted'
                    }`}
                  >
                    {r === null ? '–' : r}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`Min ${unit}`}>
              <Stepper
                label={`minimum ${unit}`}
                value={quick.min}
                step={timed ? 5 : 1}
                format={timed ? formatSeconds : undefined}
                onChange={(min) => setQuick({ ...quick, min, max: Math.max(min, quick.max) })}
              />
            </Field>
            <Field label={`Max ${unit}`}>
              <Stepper
                label={`maximum ${unit}`}
                value={quick.max}
                step={timed ? 5 : 1}
                format={timed ? formatSeconds : undefined}
                onChange={(max) => setQuick({ ...quick, max, min: Math.min(max, quick.min) })}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-muted">RIR 0 = to failure. Warm-ups below are kept.</p>
          <button
            type="button"
            onClick={applyQuick}
            className="mt-3 h-12 w-full rounded-xl bg-accent font-bold text-accent-fg"
          >
            Apply {quick.sets} ×{' '}
            {timed
              ? `${formatSeconds(quick.min)}–${formatSeconds(quick.max)}`
              : `${quick.min}–${quick.max}`}
          </button>
        </section>

        {/* Per-set targets */}
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Set by set
          </h3>
          <ul className="flex flex-col gap-2">
            {targets.map((t, i) => (
              <li key={t.id} className="rounded-2xl bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">
                    Set {i + 1} · {describeTarget(t, logType)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove set ${i + 1}`}
                    onClick={() => write(targets.filter((_, j) => j !== i).map(plain))}
                    className="h-9 w-9 rounded-full text-muted"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
                  {TYPES.map((ty) => (
                    <button
                      key={ty}
                      type="button"
                      aria-pressed={t.set_type === ty}
                      onClick={() => editTarget(i, { set_type: ty })}
                      className={`h-9 rounded-lg text-xs font-semibold ${t.set_type === ty ? 'bg-bg shadow-sm' : 'text-muted'}`}
                    >
                      {SET_TYPE_INFO[ty].name}
                    </button>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Stepper
                    label={`set ${i + 1} minimum`}
                    value={(timed ? t.seconds_min : t.reps_min) ?? 0}
                    step={timed ? 5 : 1}
                    format={timed ? formatSeconds : undefined}
                    onChange={(v) => editTarget(i, timed ? { seconds_min: v } : { reps_min: v })}
                  />
                  <Stepper
                    label={`set ${i + 1} maximum`}
                    value={(timed ? t.seconds_max : t.reps_max) ?? 0}
                    step={timed ? 5 : 1}
                    format={timed ? formatSeconds : undefined}
                    onChange={(v) => editTarget(i, timed ? { seconds_max: v } : { reps_max: v })}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="h-11 rounded-xl border border-dashed border-border text-sm font-semibold text-muted"
              onClick={() => {
                const last = targets.at(-1)
                write([
                  ...targets.map(plain),
                  last ? plain(last) : quickSets({ ...quick, sets: 1 }, logType)[0]!,
                ])
              }}
            >
              + Add set
            </button>
            <button
              type="button"
              className="h-11 rounded-xl border border-dashed border-border text-sm font-semibold text-muted"
              onClick={() =>
                write([
                  {
                    set_type: 'warmup',
                    reps_min: timed ? null : 10,
                    reps_max: timed ? null : 10,
                    seconds_min: timed ? 20 : null,
                    seconds_max: timed ? 20 : null,
                    target_rir: null,
                  },
                  ...targets.map(plain),
                ])
              }
            >
              + Warm-up set
            </button>
          </div>
        </section>

        {/* Progression */}
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Progression
          </h3>
          <div className="flex flex-col gap-2">
            {PROGRESSION.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={pe.progression_rule === p.id}
                onClick={() => void updatePlanExercise(pe, { progression_rule: p.id })}
                className={`flex min-h-12 flex-col justify-center rounded-xl px-4 py-2 text-left ${
                  pe.progression_rule === p.id ? 'bg-accent text-accent-fg' : 'bg-surface'
                }`}
              >
                <span className="font-semibold">{p.name}</span>
                <span
                  className={`text-xs ${pe.progression_rule === p.id ? 'opacity-80' : 'text-muted'}`}
                >
                  {p.hint}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Suggestions based on this arrive in a later update.
          </p>
        </section>

        {/* Superset */}
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Superset
          </h3>
          {pe.group_id ? (
            <div className="rounded-2xl bg-surface p-4">
              <p className="text-sm">
                With:{' '}
                {groupMates
                  .filter((m) => m.id !== pe.id)
                  .map((m) => names.get(m.exercise_id))
                  .join(', ')}
              </p>
              <button
                type="button"
                className="mt-2 h-10 text-sm font-semibold text-danger"
                onClick={() => void unlinkGroup(list, pe)}
              >
                Unlink superset
              </button>
            </div>
          ) : index < list.length - 1 ? (
            <button
              type="button"
              className="h-12 w-full rounded-xl bg-surface font-semibold"
              onClick={() => void linkWithNext(list, index)}
            >
              Superset with next: {names.get(list[index + 1]!.exercise_id)}
            </button>
          ) : (
            <p className="text-sm text-muted">
              Move another exercise below this one to superset them.
            </p>
          )}
        </section>

        {/* Alternatives */}
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Swap options (if the kit’s taken)
          </h3>
          <ul className="flex flex-col gap-2">
            {pe.alternatives.map((id) => (
              <li
                key={id}
                className="flex items-center justify-between rounded-xl bg-surface px-4 py-3"
              >
                <span className="truncate">{names.get(id) ?? 'Unknown'}</span>
                <button
                  type="button"
                  aria-label="Remove swap option"
                  className="h-8 w-8 text-muted"
                  onClick={() =>
                    void updatePlanExercise(pe, {
                      alternatives: pe.alternatives.filter((a) => a !== id),
                    })
                  }
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 h-11 w-full rounded-xl border border-dashed border-border text-sm font-semibold text-muted"
            onClick={() => setPickingAlt(true)}
          >
            + Add swap option
          </button>
        </section>

        {/* Notes */}
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Notes & cues
          </h3>
          <textarea
            defaultValue={pe.notes ?? ''}
            placeholder="Seat height, tempo, cues…"
            rows={2}
            className="w-full resize-none rounded-2xl bg-surface p-4 outline-none"
            onBlur={(e) => {
              const notes = e.target.value.trim() || null
              if (notes !== pe.notes) void updatePlanExercise(pe, { notes })
            }}
          />
        </section>

        <button
          type="button"
          className="h-12 rounded-xl bg-surface font-semibold text-danger"
          onClick={async () => {
            await removePlanExercise(pe)
            onClose()
            showToast({ message: `Removed ${exercise?.name ?? 'exercise'}` })
          }}
        >
          Remove from session
        </button>
      </div>

      <Sheet
        open={pickingAlt}
        title="Add swap option"
        closeLabel="Cancel"
        onClose={() => setPickingAlt(false)}
      >
        <ExerciseList
          added={new Set([pe.exercise_id, ...pe.alternatives])}
          onPick={(e) => {
            setPickingAlt(false)
            if (e.id === pe.exercise_id || pe.alternatives.includes(e.id)) return
            void updatePlanExercise(pe, { alternatives: [...pe.alternatives, e.id] })
          }}
        />
      </Sheet>
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      {children}
    </div>
  )
}
