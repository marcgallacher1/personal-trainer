import { DAY_NAMES } from '../../lib/plans/draft'

/** Mon–Sun toggles for which day(s) a workout is on. */
export function DayButtons({
  selected,
  onToggle,
}: {
  selected: number[]
  onToggle: (d: number) => void
}) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
        {selected.length ? 'On' : 'Add to plan on'}
      </p>
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map((d, i) => {
          const on = selected.includes(i + 1)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(i + 1)}
              className={`h-11 rounded-lg text-xs font-bold ${
                on ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted'
              }`}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}
