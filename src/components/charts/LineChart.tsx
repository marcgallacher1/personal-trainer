import { useState, type PointerEvent } from 'react'
import { H, PAD, PLOT_H, PLOT_W, W, labelIndices, linear, niceTicks, shortDate } from './scales'

export interface LinePoint {
  /** YYYY-MM-DD */
  date: string
  value: number
  /** Ringed marker, e.g. a PB */
  marker?: boolean
  /** Extra line in the tooltip */
  note?: string
}

/** Line chart over time with highlight markers, tap tooltips and an optional target line. */
export function LineChart({
  points,
  format,
  colour = 'var(--color-accent)',
  domain,
  target,
  targetLabel,
  label,
}: {
  points: readonly LinePoint[]
  format: (v: number) => string
  colour?: string
  /** Fixed y-domain (e.g. 0–100 for percentages); otherwise fitted to the data */
  domain?: [number, number]
  target?: number
  targetLabel?: string
  label: string
}) {
  const [active, setActive] = useState<number | null>(null)
  if (!points.length)
    return <p className="py-10 text-center text-sm text-muted">No data in this range yet.</p>

  const values = points.map((p) => p.value).concat(target ?? [])
  const lo = domain?.[0] ?? Math.min(...values) * 0.95
  const hi = domain?.[1] ?? Math.max(...values) * 1.03
  const ticks = niceTicks(lo, hi)
  const y = linear(ticks[0]!, ticks.at(-1)!, PAD.top + PLOT_H, PAD.top)
  const x = linear(
    0,
    Math.max(1, points.length - 1),
    PAD.left + (points.length === 1 ? PLOT_W / 2 : 0),
    PAD.left + (points.length === 1 ? PLOT_W / 2 : PLOT_W),
  )
  const path = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join('')
  const a = active !== null ? points[active] : undefined

  function pick(e: PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
    const sx = ((e.clientX - box.left) / box.width) * W
    const i = Math.round(((sx - PAD.left) / PLOT_W) * (points.length - 1))
    setActive(Math.max(0, Math.min(points.length - 1, i)))
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--color-border)"
              strokeWidth="0.75"
            />
            <text
              x={PAD.left - 6}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="10"
              fill="var(--color-muted)"
            >
              {format(t)}
            </text>
          </g>
        ))}
        {labelIndices(points.length).map((i, n, all) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            textAnchor={n === all.length - 1 && all.length > 1 ? 'end' : 'middle'}
            fontSize="10"
            fill="var(--color-muted)"
          >
            {shortDate(points[i]!.date)}
          </text>
        ))}
        {target !== undefined && (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(target)}
            y2={y(target)}
            stroke="var(--color-muted)"
            strokeWidth="1.25"
            strokeDasharray="4 4"
            aria-label={targetLabel}
          />
        )}
        <path
          d={path}
          fill="none"
          stroke={colour}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) =>
          p.marker || points.length === 1 ? (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p.value)}
              r="4.5"
              fill={colour}
              stroke="var(--color-surface)"
              strokeWidth="2"
            />
          ) : null,
        )}
        {a && active !== null && (
          <g pointerEvents="none">
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke="var(--color-muted)"
              strokeWidth="1"
            />
            <circle
              cx={x(active)}
              cy={y(a.value)}
              r="5"
              fill={colour}
              stroke="var(--color-surface)"
              strokeWidth="2"
            />
          </g>
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="transparent"
          onPointerDown={pick}
          onPointerMove={pick}
          onPointerLeave={() => setActive(null)}
          style={{ touchAction: 'pan-y' }}
        />
      </svg>
      {a && active !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg bg-text px-2.5 py-1.5 text-xs text-bg shadow-lg"
          style={{
            left: `${(x(active) / W) * 100}%`,
            transform: `translateX(${x(active) > W / 2 ? '-105%' : '5%'})`,
          }}
        >
          <p className="font-semibold">{format(a.value)}</p>
          <p className="opacity-80">
            {shortDate(a.date)}
            {a.marker ? ' · PB' : ''}
          </p>
          {a.note && <p className="opacity-80">{a.note}</p>}
        </div>
      )}
    </div>
  )
}
