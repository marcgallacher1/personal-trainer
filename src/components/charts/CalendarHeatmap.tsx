import { useState } from 'react'
import { addDays, weekOf, weeksBetween } from '../../lib/analysis/training'
import { intensityLevel } from '../../lib/analysis/volume'
import { shortDate } from './scales'

const SHADE = [0, 0.3, 0.5, 0.72, 1]
const ROWS = ['M', '', 'W', '', 'F', '', 'S']

/**
 * One square per day, a column per week (Monday at the top), shaded by working sets. Tap a day
 * to see what you did.
 */
export function CalendarHeatmap({
  setsByDay,
  from,
  to,
}: {
  setsByDay: ReadonlyMap<string, number>
  from: string
  to: string
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const weeks = weeksBetween(from, to)
  const cell = Math.max(5, Math.min(18, Math.floor(300 / weeks.length) - 2))
  const gap = cell > 8 ? 3 : 2
  const left = 14
  const top = 14
  const width = left + weeks.length * (cell + gap)
  const height = top + 7 * (cell + gap)
  const sets = picked ? (setsByDay.get(picked) ?? 0) : 0

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', maxWidth: width * 2.2 }}
          role="img"
          aria-label="Training calendar"
        >
          {ROWS.map((r, i) =>
            r ? (
              <text
                key={i}
                x={0}
                y={top + i * (cell + gap) + cell / 2}
                dominantBaseline="central"
                fontSize="8"
                fill="var(--color-muted)"
              >
                {r}
              </text>
            ) : null,
          )}
          {weeks.map((w, c) => {
            const month = w.slice(0, 7) !== addDays(w, -7).slice(0, 7) || c === 0
            return (
              <g key={w}>
                {month && c < weeks.length - 1 && (
                  <text x={left + c * (cell + gap)} y={8} fontSize="8" fill="var(--color-muted)">
                    {shortDate(addDays(w, 6)).split(' ')[1]}
                  </text>
                )}
                {Array.from({ length: 7 }, (_, d) => {
                  const day = addDays(w, d)
                  if (day < from || day > to) return null
                  const n = setsByDay.get(day) ?? 0
                  const level = intensityLevel(n)
                  return (
                    <rect
                      key={day}
                      x={left + c * (cell + gap)}
                      y={top + d * (cell + gap)}
                      width={cell}
                      height={cell}
                      rx={Math.min(3, cell / 4)}
                      fill={level ? 'var(--color-accent)' : 'var(--color-surface-2)'}
                      fillOpacity={level ? SHADE[level] : 1}
                      stroke={picked === day ? 'var(--color-text)' : 'none'}
                      strokeWidth="1.5"
                      onPointerDown={() => setPicked(picked === day ? null : day)}
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
        <span>
          {picked
            ? `${shortDate(picked)} (w/c ${shortDate(weekOf(picked))}): ${sets ? `${sets} working sets` : 'rest day'}`
            : 'Tap a day for details'}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          Less
          {SHADE.map((o, i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-sm"
              style={{
                background: i ? 'var(--color-accent)' : 'var(--color-surface-2)',
                opacity: i ? o : 1,
              }}
            />
          ))}
          More
        </span>
      </div>
    </div>
  )
}
