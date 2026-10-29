import { useState } from 'react'
import { Stepper } from '../../components/Stepper'
import { formatSeconds } from '../../lib/logging/pr'
import { REP_STEP, RIR_EXPLAINER, RIR_OPTIONS, WEIGHT_STEP_KG } from '../../lib/logging/settings'
import { isTimed, type DraftSet, type LogType, type SetType } from '../../lib/logging/types'

export const SET_TYPE_INFO: Record<
  SetType,
  { name: string; short: string; hint: string; pill: string }
> = {
  working: {
    name: 'Working',
    short: '',
    hint: 'A normal set. Counts towards progress, volume and PBs.',
    pill: '',
  },
  warmup: {
    name: 'Warm-up',
    short: 'Warm-up',
    hint: 'Lighter prep set. Not counted in volume or PBs.',
    pill: 'bg-amber-400/20 text-amber-600 dark:text-amber-400',
  },
  drop: {
    name: 'Drop',
    short: 'Drop',
    hint: 'Weight reduced straight after the previous set, no rest.',
    pill: 'bg-sky-400/20 text-sky-600 dark:text-sky-400',
  },
  failure: {
    name: 'Failure',
    short: 'Failure',
    hint: 'Taken until you couldn’t do another rep.',
    pill: 'bg-red-400/20 text-red-600 dark:text-red-400',
  },
}

const TYPES: SetType[] = ['working', 'warmup', 'drop', 'failure']
const TIME_STEP_SECONDS = 5

export interface EditorValue extends DraftSet {
  rir: number | null
}

interface Props {
  logType: LogType
  initial: EditorValue
  heading: string
  /** Plan target for this set, shown under the heading */
  target?: string
  submitLabel: string
  onSubmit: (v: EditorValue) => void
  /** Optional second action shown left of the primary one, e.g. "Log & close" */
  secondaryLabel?: string
  onSecondary?: (v: EditorValue) => void
  onDelete?: () => void
  onCancel?: () => void
}

/** Roomy, labelled editor for one set. Fields adapt to how the exercise is logged. */
export function SetEditor({
  logType,
  initial,
  heading,
  target,
  submitLabel,
  onSubmit,
  secondaryLabel,
  onSecondary,
  onDelete,
  onCancel,
}: Props) {
  const timed = isTimed(logType)
  const optionalLoad = logType === 'bodyweight_reps' || logType === 'duration'
  const [v, setV] = useState<EditorValue>(initial)
  const [showAdded, setShowAdded] = useState(initial.weight_kg > 0)
  const seconds = v.duration_seconds ?? 0
  const invalid = timed ? seconds <= 0 : v.reps <= 0

  /** Normalise before saving: timed sets have no reps; rep sets have no time; no RIR on holds. */
  const finalValue = (): EditorValue => ({
    ...v,
    weight_kg: optionalLoad && !showAdded ? 0 : v.weight_kg,
    reps: timed ? 0 : v.reps,
    duration_seconds: timed ? seconds : null,
    rir: timed ? null : v.rir,
  })

  const weightStepper = (label: string) => (
    <Stepper
      label={label}
      value={v.weight_kg}
      step={WEIGHT_STEP_KG}
      decimals
      onChange={(weight_kg) => setV({ ...v, weight_kg })}
    />
  )

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-lg font-bold">{heading}</h3>
          {target && <p className="text-sm font-semibold text-accent">Target: {target}</p>}
        </div>
        {onCancel && (
          <button type="button" className="h-9 text-sm text-muted" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {(logType === 'weight_reps' || logType === 'weight_duration') && (
          <Labelled label="Weight (kg)">{weightStepper('weight')}</Labelled>
        )}
        {logType === 'assisted_reps' && (
          <Labelled label="Assistance (kg)" hint="Less assistance = harder.">
            {weightStepper('assistance')}
          </Labelled>
        )}

        {timed ? (
          <Labelled label="Time">
            <Stepper
              label="time in seconds"
              value={seconds}
              step={TIME_STEP_SECONDS}
              format={formatSeconds}
              onChange={(duration_seconds) => setV({ ...v, duration_seconds })}
            />
          </Labelled>
        ) : (
          <Labelled label="Reps">
            <Stepper
              label="reps"
              value={v.reps}
              step={REP_STEP}
              onChange={(reps) => setV({ ...v, reps })}
            />
          </Labelled>
        )}

        {optionalLoad &&
          (showAdded ? (
            <Labelled label="Added weight (kg)">
              {weightStepper('added weight')}
              <button
                type="button"
                className="mt-1 h-9 text-sm text-muted"
                onClick={() => setShowAdded(false)}
              >
                Remove added weight
              </button>
            </Labelled>
          ) : (
            <button
              type="button"
              className="h-11 rounded-xl border border-dashed border-border text-sm font-semibold text-muted"
              onClick={() => setShowAdded(true)}
            >
              + Add weight (belt, vest or plate)
            </button>
          ))}
      </div>

      <Labelled label="Set type" hint={SET_TYPE_INFO[v.set_type].hint}>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-surface-2 p-1">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={v.set_type === t}
              onClick={() => setV({ ...v, set_type: t })}
              className={`h-10 rounded-lg text-sm font-semibold ${
                v.set_type === t ? 'bg-bg text-text shadow-sm' : 'text-muted'
              }`}
            >
              {SET_TYPE_INFO[t].name}
            </button>
          ))}
        </div>
      </Labelled>

      {!timed && (
        <Labelled label="Reps in reserve (optional)" hint={RIR_EXPLAINER}>
          <div className="grid grid-cols-5 gap-2">
            {RIR_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={v.rir === r}
                className={`h-11 rounded-xl text-base font-semibold ${
                  v.rir === r ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted'
                }`}
                onClick={() => setV({ ...v, rir: v.rir === r ? null : r })}
              >
                {r === 4 ? '4+' : r}
              </button>
            ))}
          </div>
        </Labelled>
      )}

      <div className="flex gap-2">
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            disabled={invalid}
            className="h-14 flex-1 basis-0 rounded-2xl bg-surface-2 text-lg font-semibold active:scale-[0.98] disabled:opacity-40"
            onClick={() => onSecondary(finalValue())}
          >
            {secondaryLabel}
          </button>
        )}
        <button
          type="button"
          disabled={invalid}
          className="h-14 flex-1 basis-0 rounded-2xl bg-accent text-lg font-bold text-accent-fg active:scale-[0.98] disabled:opacity-40"
          onClick={() => onSubmit(finalValue())}
        >
          {submitLabel}
        </button>
      </div>
      {invalid && (
        <p className="-mt-2 text-center text-xs text-muted">
          Enter your {timed ? 'time' : 'reps'} to log the set.
        </p>
      )}

      {onDelete && (
        <button type="button" className="h-10 text-sm font-semibold text-danger" onClick={onDelete}>
          Delete this set
        </button>
      )}
    </div>
  )
}

function Labelled({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  )
}
