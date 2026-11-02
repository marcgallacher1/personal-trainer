import { useState } from 'react'
import type { MuscleVolume } from '../../lib/rating/rate'

/** Front and back body, each muscle coloured by weekly sets vs its target. */

/** One shape on the left half of a figure (mirrored for the right). */
interface Shape {
  muscle: string | null
  d?: string
  ellipse?: [cx: number, cy: number, rx: number, ry: number, rotate?: number]
  rect?: [x: number, y: number, w: number, h: number]
}

const LIMBS: Shape[] = [
  { muscle: null, ellipse: [28, 109, 4, 5] }, // hand
  { muscle: null, ellipse: [46, 205, 6, 3] }, // foot
]

const FRONT: Shape[] = [
  ...LIMBS,
  { muscle: null, ellipse: [47, 181, 5.5, 20] }, // shin
  { muscle: 'side_delts', ellipse: [33, 45, 6, 8] },
  { muscle: 'front_delts', ellipse: [40, 42, 6, 6] },
  { muscle: 'chest', d: 'M59 38 C50 37 44 40 42 47 C41 55 46 61 53 61 C57 61 59 58 59 55 Z' },
  { muscle: 'biceps', ellipse: [33, 64, 5, 11] },
  { muscle: 'forearms', ellipse: [30, 90, 4.5, 13, 8] },
  { muscle: 'abs', rect: [52.5, 64, 7, 36] },
  { muscle: 'obliques', d: 'M51 65 C45 69 44 83 46 98 L51 100 Z' },
  { muscle: 'quads', ellipse: [47, 133, 8, 24] },
  { muscle: 'adductors', d: 'M59 108 C55 111 54 122 55 138 L59 140 Z' },
]

const BACK: Shape[] = [
  ...LIMBS,
  { muscle: 'upper_back', d: 'M59 29 L52 33 L42 40 L48 50 L59 70 Z' },
  { muscle: 'rear_delts', ellipse: [36, 45, 7, 6] },
  { muscle: 'triceps', ellipse: [33, 64, 5, 11] },
  { muscle: 'forearms', ellipse: [30, 90, 4.5, 13, 8] },
  { muscle: 'lats', d: 'M44 50 C40 62 44 80 53 92 L59 86 L59 72 L49 52 Z' },
  { muscle: 'lower_back', rect: [53, 87, 6.5, 15] },
  { muscle: 'glutes', ellipse: [50, 113, 9.5, 10] },
  { muscle: 'hamstrings', ellipse: [48, 144, 8, 20] },
  { muscle: 'calves', ellipse: [47, 182, 6, 15] },
]

function fillFor(m: MuscleVolume | undefined): { fill: string; opacity: number } {
  if (!m) return { fill: 'var(--color-surface-2)', opacity: 1 }
  if (m.paused) return { fill: 'var(--color-muted)', opacity: 0.18 }
  if (m.status === 'low') {
    return { fill: 'var(--color-warn)', opacity: 0.3 + 0.6 * Math.min(1, m.sets / (m.min || 1)) }
  }
  if (m.status === 'high') return { fill: 'var(--color-danger)', opacity: 0.8 }
  if (m.sets === 0) return { fill: 'var(--color-surface-2)', opacity: 1 }
  return { fill: 'var(--color-accent)', opacity: 0.55 + 0.4 * Math.min(1, m.sets / (m.max || 1)) }
}

function Figure({
  shapes,
  label,
  muscles,
  selected,
  onSelect,
}: {
  shapes: Shape[]
  label: string
  muscles: ReadonlyMap<string, MuscleVolume>
  selected: string | null
  onSelect: (id: string) => void
}) {
  const half = (mirror: boolean) =>
    shapes.map((s, i) => {
      const m = s.muscle ? muscles.get(s.muscle) : undefined
      const { fill, opacity } = s.muscle
        ? fillFor(m)
        : { fill: 'var(--color-surface-2)', opacity: 1 }
      const props = {
        fill,
        fillOpacity: opacity,
        stroke: s.muscle && s.muscle === selected ? 'var(--color-text)' : 'var(--color-border)',
        strokeWidth: s.muscle && s.muscle === selected ? 1.5 : 0.6,
        onClick: s.muscle ? () => onSelect(s.muscle!) : undefined,
        className: s.muscle ? 'cursor-pointer' : undefined,
      }
      const key = `${mirror ? 'r' : 'l'}${i}`
      if (s.ellipse) {
        const [cx, cy, rx, ry, rot] = s.ellipse
        return (
          <ellipse
            key={key}
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}
            {...props}
          />
        )
      }
      if (s.rect) {
        const [x, y, width, height] = s.rect
        return <rect key={key} x={x} y={y} width={width} height={height} rx={3} {...props} />
      }
      return <path key={key} d={s.d} {...props} />
    })
  return (
    <figure className="flex flex-1 flex-col items-center gap-1">
      <svg viewBox="0 0 120 212" className="h-64 w-full" role="img" aria-label={`${label} of body`}>
        <circle
          cx="60"
          cy="15"
          r="11"
          fill="var(--color-surface-2)"
          stroke="var(--color-border)"
          strokeWidth="0.6"
        />
        <rect x="55" y="25" width="10" height="9" fill="var(--color-surface-2)" />
        <g>{half(false)}</g>
        <g transform="matrix(-1 0 0 1 120 0)">{half(true)}</g>
      </svg>
      <figcaption className="text-xs font-semibold tracking-wide text-muted uppercase">
        {label}
      </figcaption>
    </figure>
  )
}

const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))

export function BodyMap({ muscles }: { muscles: readonly MuscleVolume[] }) {
  const byId = new Map(muscles.map((m) => [m.id, m]))
  const [selected, setSelected] = useState<string | null>(null)
  const m = selected ? byId.get(selected) : undefined

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Figure
          shapes={FRONT}
          label="Front"
          muscles={byId}
          selected={selected}
          onSelect={setSelected}
        />
        <Figure
          shapes={BACK}
          label="Back"
          muscles={byId}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
        <Key colour="var(--color-warn)">Could use more</Key>
        <Key colour="var(--color-accent)">In range</Key>
        <Key colour="var(--color-danger)">A lot</Key>
        <Key colour="var(--color-muted)" faint>
          Paused
        </Key>
      </div>
      <div className="min-h-16 rounded-2xl bg-surface-2 p-3 text-sm">
        {m ? (
          <>
            <p className="font-bold">
              {m.name}
              {m.priority && (
                <span className="ml-2 text-xs font-semibold text-accent">Priority</span>
              )}
            </p>
            <p className="text-muted">
              {m.paused
                ? 'Paused in your goals — not counted.'
                : `${fmt(m.sets)} sets a week (aim for ${m.min}–${m.max}) · trained ${
                    m.frequency >= 1.75
                      ? `${fmt(Math.round(m.frequency))}× a week`
                      : m.frequency > 0
                        ? 'about once a week'
                        : 'not yet'
                  }`}
            </p>
          </>
        ) : (
          <p className="pt-2 text-center text-muted">Tap a muscle to see its weekly sets.</p>
        )}
      </div>
    </div>
  )
}

function Key({
  colour,
  faint = false,
  children,
}: {
  colour: string
  faint?: boolean
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-3 w-3 rounded-full"
        style={{ background: colour, opacity: faint ? 0.3 : 0.85 }}
      />
      {children}
    </span>
  )
}
