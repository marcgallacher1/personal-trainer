import { useState } from 'react'
import { Stepper } from '../../components/Stepper'
import { REP_STEP, RIR_OPTIONS, WEIGHT_STEP_KG } from '../../lib/logging/settings'
import type { DraftSet, SetType } from '../../lib/logging/types'

export const SET_TYPE_BADGE: Record<SetType, { short: string; name: string; className: string }> = {
  working: { short: '', name: 'Working', className: 'bg-surface-2 text-text' },
  warmup: { short: 'W', name: 'Warm-up', className: 'bg-amber-400/20 text-amber-500' },
  drop: { short: 'D', name: 'Drop set', className: 'bg-sky-400/20 text-sky-500' },
  failure: { short: 'F', name: 'To failure', className: 'bg-red-400/20 text-red-500' },
}

const CYCLE: SetType[] = ['working', 'warmup', 'drop', 'failure']

export interface EditorValue extends DraftSet {
  rir: number | null
}

interface Props {
  initial: EditorValue
  /** Shown in the badge for working sets */
  setNumber: number
  submitLabel: string
  onSubmit: (v: EditorValue) => void
  onDelete?: () => void
  onCancel?: () => void
}

export function SetEditor({
  initial,
  setNumber,
  submitLabel,
  onSubmit,
  onDelete,
  onCancel,
}: Props) {
  const [v, setV] = useState<EditorValue>(initial)
  const badge = SET_TYPE_BADGE[v.set_type]

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-accent/40 bg-surface p-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Set type: ${badge.name}. Tap to change.`}
          className={`h-12 w-10 shrink-0 rounded-xl text-sm font-bold ${badge.className}`}
          onClick={() =>
            setV({ ...v, set_type: CYCLE[(CYCLE.indexOf(v.set_type) + 1) % CYCLE.length]! })
          }
        >
          {badge.short || setNumber}
        </button>
        <div className="min-w-0 flex-[1.2]">
          <Stepper
            label="weight"
            value={v.weight_kg}
            step={WEIGHT_STEP_KG}
            unit="kg"
            decimals
            onChange={(weight_kg) => setV({ ...v, weight_kg })}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Stepper
            label="reps"
            value={v.reps}
            step={REP_STEP}
            onChange={(reps) => setV({ ...v, reps })}
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="w-9 shrink-0 text-center text-xs font-semibold text-muted">RIR</span>
        {RIR_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={v.rir === r}
            className={`h-11 min-w-0 flex-1 rounded-lg text-sm font-semibold ${
              v.rir === r ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted'
            }`}
            onClick={() => setV({ ...v, rir: v.rir === r ? null : r })}
          >
            {r === 4 ? '4+' : r}
          </button>
        ))}
        <button
          type="button"
          disabled={v.reps <= 0}
          className="ml-1 h-11 shrink-0 rounded-lg bg-accent px-4 font-bold text-accent-fg disabled:opacity-40"
          onClick={() => onSubmit(v)}
        >
          {submitLabel}
        </button>
      </div>

      {(onDelete || onCancel) && (
        <div className="flex justify-between px-1 text-sm">
          {onDelete ? (
            <button type="button" className="h-10 text-danger" onClick={onDelete}>
              Delete set
            </button>
          ) : (
            <span />
          )}
          {onCancel && (
            <button type="button" className="h-10 text-muted" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}
