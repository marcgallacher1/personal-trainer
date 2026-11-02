/**
 * A spider chart comparing two series (e.g. planned vs actual sets per muscle group). Values are
 * scaled to the largest on any axis.
 */
export function RadarChart({
  axes,
  series,
  label,
}: {
  axes: readonly { id: string; label: string }[]
  series: readonly {
    name: string
    colour: string
    values: Record<string, number>
    dashed?: boolean
  }[]
  label: string
}) {
  const size = 260
  const c = size / 2
  const r = c - 38
  const max = Math.max(1, ...series.flatMap((s) => axes.map((a) => s.values[a.id] ?? 0)))
  const angle = (i: number) => -Math.PI / 2 + (i / axes.length) * Math.PI * 2
  const pt = (i: number, v: number) => {
    const d = (v / max) * r
    return [c + Math.cos(angle(i)) * d, c + Math.sin(angle(i)) * d] as const
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto w-full max-w-72"
      role="img"
      aria-label={label}
    >
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={axes.map((_, i) => pt(i, f * max).join(',')).join(' ')}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="0.75"
        />
      ))}
      {axes.map((a, i) => {
        const [x, y] = pt(i, max)
        const [lx, ly] = pt(i, max * 1.2)
        return (
          <g key={a.id}>
            <line x1={c} y1={c} x2={x} y2={y} stroke="var(--color-border)" strokeWidth="0.75" />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="11"
              fill="var(--color-muted)"
            >
              {a.label}
            </text>
          </g>
        )
      })}
      {series.map((s) => (
        <polygon
          key={s.name}
          points={axes.map((a, i) => pt(i, s.values[a.id] ?? 0).join(',')).join(' ')}
          fill={s.dashed ? 'none' : s.colour}
          fillOpacity={0.18}
          stroke={s.colour}
          strokeWidth="2"
          strokeDasharray={s.dashed ? '5 4' : undefined}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}
