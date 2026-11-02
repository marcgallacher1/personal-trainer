import { Link } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { addDays, weekOf } from '../../lib/analysis/training'
import type { WeeklyReport } from '../../lib/report/weekly'
import { isoWeek } from '../../lib/time/london'
import { useReports } from './data'

const DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
const dayMonth = (date: string) => DAY_MONTH.format(new Date(`${date}T12:00:00Z`))

/** "26 Oct – 1 Nov" */
export const weekRange = (week: string) => `${dayMonth(week)} – ${dayMonth(addDays(week, 6))}`

/** Every week, newest first: a one-line summary each. */
export function ReportsScreen() {
  const reports = useReports()
  if (!reports) return null
  const current = weekOf(reports.today)
  return (
    <div className="flex flex-col gap-4">
      <BackButton fallback="/more" label="More" />
      <h1 className="text-3xl font-bold tracking-tight">Weekly reports</h1>
      <p className="-mt-2 text-sm text-muted">
        A rundown of each week with 3 things to do next. A new one lands every Sunday evening.
      </p>
      {reports.weeks.length === 0 && (
        <p className="rounded-2xl bg-surface p-4 text-center text-sm text-muted">
          Log a workout and your first report will appear here.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {reports.weeks.map((w) => (
          <li key={w}>
            <Row week={w} report={reports.build(w)} current={w === current} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function Row({ week, report, current }: { week: string; report: WeeklyReport; current: boolean }) {
  const { done, planned } = report.workouts
  const hit = planned !== null && done >= planned
  return (
    <Link
      to={`/reports/${isoWeek(week)}`}
      className="flex items-center gap-3 rounded-2xl bg-surface p-4 active:opacity-80"
    >
      <span
        className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-sm leading-tight font-bold tabular-nums ${
          hit ? 'bg-success/15 text-success' : 'bg-surface-2'
        }`}
      >
        {done}
        {planned !== null && <span className="text-xs font-semibold text-muted">of {planned}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">
          {current && !report.final ? 'This week so far' : weekRange(week)}
        </span>
        <span className="block truncate text-sm text-muted">
          {[
            `${report.sets} sets`,
            report.pbs.length > 0 && `${report.pbs.length} PB${report.pbs.length === 1 ? '' : 's'}`,
            report.stalls.length > 0 && `${report.stalls.length} stalled`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className="text-2xl text-muted">›</span>
    </Link>
  )
}
