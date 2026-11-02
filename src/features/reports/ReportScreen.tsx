import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { supabase } from '../../db/supabase'
import { addDays, weekOf } from '../../lib/analysis/training'
import { mondayOfIsoWeek, type WeeklyReport } from '../../lib/report/weekly'
import { isoWeek } from '../../lib/time/london'
import { BodyMap } from '../plans/BodyMap'
import { MuscleBars } from '../progress/MuscleBars'
import { storeReport, useReports, useStoredReport } from './data'
import { weekRange } from './ReportsScreen'

/** Off unless VITE_REPORT_AI=on and the server has an Anthropic key. */
const AI_ON = import.meta.env.VITE_REPORT_AI === 'on'

export function ReportScreen() {
  const { week: iso = '' } = useParams()
  const week = mondayOfIsoWeek(iso)
  const reports = useReports()
  if (!week) return <Navigate to="/reports" replace />
  if (!reports) return null
  const report = reports.build(week)
  const current = weekOf(reports.today)
  const first = reports.weeks.at(-1) ?? current
  return (
    <Report
      key={week}
      report={report}
      prev={week > first ? addDays(week, -7) : null}
      next={week < current ? addDays(week, 7) : null}
    />
  )
}

function Report({
  report,
  prev,
  next,
}: {
  report: WeeklyReport
  prev: string | null
  next: string | null
}) {
  const stored = useStoredReport(report.week)

  // Save finished weeks so they're kept on the server too
  useEffect(() => {
    if (report.final) void storeReport(report)
  }, [report])

  const pct = report.last.sets
    ? Math.round(((report.sets - report.last.sets) / report.last.sets) * 100)
    : null

  return (
    <div className="flex flex-col gap-4">
      <BackButton fallback="/reports" label="Reports" />
      <div>
        <p className="text-sm text-muted">{weekRange(report.week)}</p>
        <h1 className="text-3xl font-bold tracking-tight">
          {report.final ? 'Weekly rundown' : 'This week so far'}
        </h1>
        <p className="mt-1">{report.headline}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Tile
          label="Workouts"
          value={`${report.workouts.done}${report.workouts.planned !== null ? `/${report.workouts.planned}` : ''}`}
        />
        <Tile
          label="Sets"
          value={String(report.sets)}
          note={
            pct !== null && report.final && pct !== 0
              ? `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}%`
              : undefined
          }
        />
        <Tile label="PBs" value={String(report.pbs.length)} />
      </div>

      <AiNote
        week={report.week}
        stored={stored?.llm_summary_text ?? null}
        ready={Boolean(stored) && report.final}
      />

      {report.actions.length > 0 && (
        <Section title={report.final ? 'Next week' : 'This week'}>
          <ol className="flex flex-col gap-2">
            {report.actions.map((a, i) => (
              <li key={a.id} className="flex gap-3 rounded-2xl bg-surface p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{a.title}</span>
                  <span className="block text-sm text-muted">{a.detail}</span>
                  {a.link && (
                    <Link
                      to={a.link.to}
                      className="mt-1 inline-block text-sm font-semibold text-accent"
                    >
                      {a.link.label} ›
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {report.sets > 0 && (
        <Section title="Sets per muscle" subtitle="Bars show sets against your weekly aim">
          <div className="rounded-2xl bg-surface p-4">
            <BodyMap muscles={report.muscles} />
            <MuscleBars muscles={report.muscles} />
          </div>
        </Section>
      )}

      {report.pbs.length > 0 && (
        <Section title="PBs 🏆">
          <List
            items={report.pbs.map((p) => ({
              key: p.exerciseId,
              to: `/exercises/${p.exerciseId}`,
              main: p.name,
              side: `${p.weightKg} kg × ${p.reps}`,
            }))}
          />
        </Section>
      )}

      {report.stalls.length > 0 && (
        <Section title="Stalled" subtitle="No new best in 3+ workouts">
          <List
            items={report.stalls.map((s) => ({
              key: s.exerciseId,
              to: `/exercises/${s.exerciseId}`,
              main: s.name,
              side: `${s.workouts} workouts`,
            }))}
          />
        </Section>
      )}

      {(report.balance.length > 0 || report.protein || report.streak > 0) && (
        <Section title="Also">
          <ul className="flex flex-col divide-y divide-border rounded-2xl bg-surface px-4 text-sm">
            {report.streak > 0 && (
              <li className="py-3">🔥 {report.streak}-week streak of hitting your plan.</li>
            )}
            {report.balance.map((b) => (
              <li key={b} className="py-3">
                ⚖️ {b}
              </li>
            ))}
            {report.protein && (
              <li className="py-3">
                🥩 Protein target ({report.protein.target} g) hit on {report.protein.hit} of{' '}
                {report.protein.days} days logged · avg {report.protein.avg} g.
              </li>
            )}
          </ul>
        </Section>
      )}

      <div className="flex justify-between">
        {prev ? (
          <Link
            to={`/reports/${isoWeek(prev)}`}
            replace
            className="flex h-10 items-center rounded-xl bg-surface-2 px-4 font-semibold"
          >
            ‹ Earlier
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link
            to={`/reports/${isoWeek(next)}`}
            replace
            className="flex h-10 items-center rounded-xl bg-surface-2 px-4 font-semibold"
          >
            Later ›
          </Link>
        )}
      </div>
    </div>
  )
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 text-center">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted">
        {label}
        {note && <span className="ml-1 font-semibold text-text">{note}</span>}
      </p>
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      <div className="mt-2">{children}</div>
    </section>
  )
}

function List({ items }: { items: { key: string; to: string; main: string; side: string }[] }) {
  return (
    <ul className="divide-y divide-border rounded-2xl bg-surface px-4">
      {items.map((x) => (
        <li key={x.key}>
          <Link to={x.to} className="flex items-center justify-between gap-3 py-3">
            <span className="min-w-0 truncate font-semibold">{x.main}</span>
            <span className="shrink-0 text-sm text-muted tabular-nums">{x.side} ›</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** The optional AI-written summary. Asked for once; the server keeps it. */
function AiNote({ week, stored, ready }: { week: string; stored: string | null; ready: boolean }) {
  const [fetched, setFetched] = useState<string | null>(null)
  useEffect(() => {
    if (!AI_ON || !ready || stored) return
    let cancelled = false
    void supabase.functions
      .invoke<{ summary: string | null }>('report-summary', { body: { iso_week: isoWeek(week) } })
      .then(({ data }) => {
        if (!cancelled && data?.summary) setFetched(data.summary)
      })
    return () => {
      cancelled = true
    }
  }, [week, ready, stored])
  const text = stored ?? fetched
  if (!text) return null
  return (
    <section className="rounded-2xl bg-surface p-4">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">Coach’s note</p>
      <p className="mt-1 whitespace-pre-line">{text}</p>
    </section>
  )
}
