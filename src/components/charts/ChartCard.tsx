import { useState, type ReactNode } from 'react'
import { RANGES, type RangeId } from '../../lib/analysis/training'

export interface RawData {
  columns: string[]
  rows: (string | number)[][]
}

/** Chart card with a title, optional date range and a "View raw" table toggle. */
export function ChartCard({
  title,
  subtitle,
  range,
  onRange,
  raw,
  legend,
  children,
}: {
  title: string
  subtitle?: string
  range?: RangeId
  onRange?: (r: RangeId) => void
  raw: RawData
  legend?: ReactNode
  children: ReactNode
}) {
  const [showRaw, setShowRaw] = useState(false)
  return (
    <section className="rounded-3xl bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <button
          type="button"
          aria-pressed={showRaw}
          onClick={() => setShowRaw((v) => !v)}
          className="h-8 shrink-0 rounded-full bg-surface-2 px-3 text-xs font-semibold text-muted"
        >
          {showRaw ? 'View chart' : 'View raw'}
        </button>
      </div>
      {range && onRange && <RangeTabs value={range} onChange={onRange} />}
      {showRaw ? (
        <RawTable data={raw} />
      ) : (
        <>
          {children}
          {legend && <div className="mt-2">{legend}</div>}
        </>
      )}
    </section>
  )
}

export function RangeTabs({ value, onChange }: { value: RangeId; onChange: (r: RangeId) => void }) {
  return (
    <div role="tablist" className="mb-3 grid grid-cols-5 gap-1 rounded-xl bg-surface-2 p-1">
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          role="tab"
          aria-selected={value === r.id}
          onClick={() => onChange(r.id)}
          className={`h-8 rounded-lg text-xs font-semibold ${
            value === r.id ? 'bg-surface text-text shadow' : 'text-muted'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

export function RawTable({ data }: { data: RawData }) {
  if (!data.rows.length) return <p className="py-6 text-center text-sm text-muted">No data yet.</p>
  return (
    <div className="max-h-80 overflow-auto rounded-xl border border-border">
      <table className="w-full text-sm tabular-nums">
        <thead className="sticky top-0 bg-surface-2 text-left text-xs text-muted">
          <tr>
            {data.columns.map((c, i) => (
              <th key={c} className={`px-3 py-2 font-semibold ${i ? 'text-right' : ''}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={i} className={`px-3 py-1.5 ${i ? 'text-right' : 'whitespace-nowrap'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Legend({ items }: { items: { name: string; colour: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.name} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={i.dashed ? { border: `1.5px dashed ${i.colour}` } : { background: i.colour }}
          />
          {i.name}
        </span>
      ))}
    </div>
  )
}
