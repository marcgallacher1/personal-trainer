import { useState } from 'react'
import { Stepper } from '../../components/Stepper'
import { REP_STEP, RIR_EXPLAINER, RIR_OPTIONS, WEIGHT_STEP_KG } from '../../lib/logging/settings'
import type { DraftSet, SetType } from '../../lib/logging/types'

export const SET_TYPE_INFO: Record<
  SetType,
  { name: string; short: string; hint: string; pill: string }
> = {
  working: {
    name: 'Working',
    short: '',
    hint: 'A normal set. Counts towards progress, volume and PRs.',
    pill: '',
  },
  warmup: {
    name: 'Warm-up',
    short: 'Warm-up',
    hint: 'Lighter prep set. Not counted in volume or PRs.',
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

export interface EditorValue extends DraftSet {
  rir: number | null
}

interface Props {
  initial: EditorValue
  heading: string
  submitLabel: string
  onSubmit: (v: EditorValue) => void
  /** Optional second action shown left of the primary one, e.g. "Log & close" */
  secondaryLabel?: string
  onSecondary?: (v: EditorValue) => void
  onDelete?: () => void
  onCancel?: () => void
}

/** Roomy, labelled editor for one set. */
export function SetEditor({
  initial,
  heading,
  submitLabel,
  onSubmit,
  secondaryLabel,
  onSecondary,
  onDelete,
  onCancel,
}: Props) {
  const [v, setV] = useState<EditorValue>(initial)
  const invalid = v.reps <= 0

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-bold">{heading}</h3>
        {onCancel && (
          <button type="button" className="h-9 text-sm text-muted" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Labelled label="Weight (kg)">
          <Stepper
            label="weight"
            value={v.weight_kg}
            step={WEIGHT_STEP_KG}
            decimals
            onChange={(weight_kg) => setV({ ...v, weight_kg })}
          />
        </Labelled>
        <Labelled label="Reps">
          <Stepper
            label="reps"
            value={v.reps}
            step={REP_STEP}
            onChange={(reps) => setV({ ...v, reps })}
          />
        </Labelled>
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

      <div className="flex gap-2">
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            disabled={invalid}
            className="h-14 flex-1 basis-0 rounded-2xl bg-surface-2 text-lg font-semibold active:scale-[0.98] disabled:opacity-40"
            onClick={() => onSecondary(v)}
          >
            {secondaryLabel}
          </button>
        )}
        <button
          type="button"
          disabled={invalid}
          className="h-14 flex-1 basis-0 rounded-2xl bg-accent text-lg font-bold text-accent-fg active:scale-[0.98] disabled:opacity-40"
          onClick={() => onSubmit(v)}
        >
          {submitLabel}
        </button>
      </div>
      {invalid && (
        <p className="-mt-2 text-center text-xs text-muted">Enter your reps to log the set.</p>
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
