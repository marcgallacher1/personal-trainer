import type { MuscleVolume } from '../../lib/rating/rate'

const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))

/** One bar per muscle: sets against its max, coloured low / in range / a lot. */
export function MuscleBars({ muscles }: { muscles: readonly MuscleVolume[] }) {
  return (
    <ul className="mt-3 divide-y divide-border text-sm">
      {muscles
        .filter((m) => !m.paused)
        .map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-1.5">
            <span className="w-32 shrink-0 truncate">{m.name}</span>
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span
                className={`absolute inset-y-0 left-0 rounded-full ${
                  m.status === 'low' ? 'bg-warn' : m.status === 'high' ? 'bg-danger' : 'bg-accent'
                }`}
                style={{ width: `${Math.min(100, (m.sets / Math.max(1, m.max)) * 100)}%` }}
              />
            </span>
            <span className="w-16 shrink-0 text-right tabular-nums">
              {fmt(m.sets)}
              {m.min > 0 && <span className="text-muted">/{m.min}</span>}
            </span>
          </li>
        ))}
    </ul>
  )
}
