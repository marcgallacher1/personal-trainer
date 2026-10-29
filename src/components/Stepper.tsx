import { useState } from 'react'

interface Props {
  value: number
  step: number
  min?: number
  /** Unit shown after the number, e.g. "kg" */
  unit?: string
  decimals?: boolean
  /** Shown instead of 0 for optional values, e.g. "–" */
  emptyLabel?: string
  label: string
  onChange: (v: number) => void
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100))

/** − value + with big tap targets. Tap the number to type a value. */
export function Stepper({
  value,
  step,
  min = 0,
  unit,
  decimals = false,
  emptyLabel,
  label,
  onChange,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null)

  const commit = () => {
    if (editing === null) return
    const n = editing.trim() === '' ? 0 : Number(editing.replace(',', '.'))
    if (Number.isFinite(n))
      onChange(Math.max(min, decimals ? Math.round(n * 100) / 100 : Math.round(n)))
    setEditing(null)
  }

  return (
    <div className="flex items-center rounded-xl bg-surface-2" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        className="h-14 w-12 shrink-0 text-2xl text-muted active:text-text"
        onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}
      >
        −
      </button>
      {editing !== null ? (
        <input
          autoFocus
          inputMode={decimals ? 'decimal' : 'numeric'}
          value={editing}
          onChange={(e) => setEditing(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="h-14 w-full min-w-0 bg-transparent text-center text-2xl font-semibold tabular-nums outline-none"
        />
      ) : (
        <button
          type="button"
          className="h-14 w-full min-w-0 text-center text-2xl font-semibold tabular-nums"
          onClick={() => setEditing(value === 0 && emptyLabel ? '' : fmt(value))}
        >
          {value === 0 && emptyLabel ? (
            <span className="text-muted">{emptyLabel}</span>
          ) : (
            fmt(value)
          )}
          {unit && !(value === 0 && emptyLabel) && (
            <span className="ml-0.5 text-xs font-normal text-muted">{unit}</span>
          )}
        </button>
      )}
      <button
        type="button"
        aria-label={`Increase ${label}`}
        className="h-14 w-12 shrink-0 text-2xl text-muted active:text-text"
        onClick={() => onChange(Math.round((value + step) * 100) / 100)}
      >
        +
      </button>
    </div>
  )
}
