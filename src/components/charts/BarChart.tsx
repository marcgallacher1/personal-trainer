import { useState } from 'react'
import { H, PAD, PLOT_H, PLOT_W, W, labelIndices, linear, niceTicks } from './scales'

export interface BarSeries {
  id: string
  name: string
  colour: string
}

export interface Bar {
  key: string
  /** x-axis label */
  label: string
  /** Value per series id (one entry for a plain bar chart) */
  values: Record<string, number>
}

/**
 * Bars (stacked when there are several series): rounded tops anchored to the baseline, 2px gaps
 * between segments, an optional dashed target line, and a tap tooltip per bar.
 */
export function BarChart({
  bars,
  series,
  format,
  target,
  label,
}: {
  bars: readonly Bar[]
  series: readonly BarSeries[]
  format: (v: number) => string
  target?: number
  label: string
}) {
  const [active, setActive] = useState<number | null>(null)
  if (!bars.length)
    return <p className="py-10 text-center text-sm text-muted">No data in this range yet.</p>

  const totals = bars.map((b) => series.reduce((a, s) => a + (b.values[s.id] ?? 0), 0))
  const ticks = niceTicks(0, Math.max(1, ...totals, target ?? 0))
  const y = linear(0, ticks.at(-1)!, PAD.top + PLOT_H, PAD.top)
  const slot = PLOT_W / bars.length
  const bw = Math.max(2, Math.min(28, slot * 0.7))
  const a = active !== null ? bars[active] : undefined

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
        {bars.map((b, i) => {
          const cx = PAD.left + slot * (i + 0.5)
          let base = PAD.top + PLOT_H
          const segs = series.filter((s) => (b.values[s.id] ?? 0) > 0)
          return (
            <g key={b.key} opacity={active === null || active === i ? 1 : 0.45}>
              {segs.map((s, j) => {
                const h = PAD.top + PLOT_H - y(b.values[s.id] ?? 0)
                const top = base - h
                const isTop = j === segs.length - 1
                const gap = j > 0 ? 2 : 0
                const el = (
                  <path
                    key={s.id}
                    d={roundedTop(
                      cx - bw / 2,
                      top,
                      bw,
                      Math.max(0, h - gap),
                      isTop ? Math.min(4, bw / 2) : 0,
                    )}
                    fill={s.colour}
                  />
                )
                base = top
                return el
              })}
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={PLOT_H}
                fill="transparent"
                onPointerDown={() => setActive(active === i ? null : i)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
                onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
              />
            </g>
          )
        })}
        {labelIndices(bars.length, 5).map((i) => (
          <text
            key={i}
            x={PAD.left + slot * (i + 0.5)}
            y={H - 6}
            textAnchor="middle"
            fontSize="10"
            fill="var(--color-muted)"
          >
            {bars[i]!.label}
          </text>
        ))}
        {target !== undefined && (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(target)}
            y2={y(target)}
            stroke="var(--color-text)"
            strokeWidth="1.25"
            strokeDasharray="4 4"
            pointerEvents="none"
          />
        )}
      </svg>
      {a && active !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg bg-text px-2.5 py-1.5 text-xs text-bg shadow-lg"
          style={{
            left: `${((PAD.left + slot * (active + 0.5)) / W) * 100}%`,
            transform: `translateX(${active > bars.length / 2 ? '-105%' : '5%'})`,
          }}
        >
          <p className="font-semibold">{a.label}</p>
          {series.length > 1
            ? series
                .filter((s) => (a.values[s.id] ?? 0) > 0)
                .map((s) => (
                  <p key={s.id} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: s.colour }} />
                    {s.name}: {format(a.values[s.id] ?? 0)}
                  </p>
                ))
            : null}
          <p className={series.length > 1 ? 'mt-0.5 font-semibold' : ''}>
            {series.length > 1 ? 'Total: ' : ''}
            {format(totals[active] ?? 0)}
          </p>
        </div>
      )}
    </div>
  )
}

/** A bar with rounded top corners only. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return ''
  const rr = Math.min(r, h)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}
