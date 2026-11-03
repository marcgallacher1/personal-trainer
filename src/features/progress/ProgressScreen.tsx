import { useState } from 'react'
import { Link } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { BarChart } from '../../components/charts/BarChart'
import { CalendarHeatmap } from '../../components/charts/CalendarHeatmap'
import { ChartCard } from '../../components/charts/ChartCard'
import { LineChart } from '../../components/charts/LineChart'
import { shortDate } from '../../components/charts/scales'
import { summariseAdherence, weeklyAdherence } from '../../lib/analysis/adherence'
import { exerciseTrend, mostTrained, recentPbs, strengthSeries } from '../../lib/analysis/strength'
import {
  addDays,
  rangeStart,
  weekOf,
  weeksBetween,
  type RangeId,
} from '../../lib/analysis/training'
import { sessionStats, setsPerDay } from '../../lib/analysis/volume'
import { BodyMap } from '../plans/BodyMap'
import { useProfile } from '../plans/data'
import { musclesFor, useTrainingData, type TrainingData } from './data'

const pct = (v: number) => `${Math.round(v * 100)}%`
const kg = (v: number) => `${Math.round(v * 10) / 10} kg`
const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function ProgressScreen() {
  const data = useTrainingData()
  if (!data) return null
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Progress</PageTitle>
      {data.sessions.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-center text-muted">
          Log a few workouts and your progress shows up here: how closely you’re following your
          plan, muscle volume, strength and consistency.
        </p>
      ) : (
        <>
          <FollowingCard data={data} />
          <MuscleCard data={data} />
          <h2 className="mt-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Consistency
          </h2>
          <Consistency data={data} />
          <h2 className="mt-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Strength
          </h2>
          <Strength data={data} />
          <h2 className="mt-2 text-xs font-semibold tracking-wide text-muted uppercase">Effort</h2>
          <Effort data={data} />
        </>
      )}
    </div>
  )
}

/** First view: how closely you're following the active plan. */
function FollowingCard({ data }: { data: TrainingData }) {
  if (!data.active || !data.planned.length || !data.planSince) {
    return (
      <Link to="/plans" className="block rounded-3xl bg-surface p-4 active:opacity-80">
        <p className="text-lg font-bold">Following your plan</p>
        <p className="text-sm text-muted">
          Switch a plan on in Plans to see how closely you’re sticking to it. Swaps like a pull-up
          for a pulldown still count.
        </p>
      </Link>
    )
  }
  const weeks = weeklyAdherence(
    data.planned,
    data.sessions,
    data.ctx.exercises,
    data.planSince,
    data.today,
  )
  const s = summariseAdherence(weeks, data.today)
  const recent = weeks.slice(-8)
  return (
    <Link to="/progress/plan" className="block rounded-3xl bg-surface p-4 active:opacity-80">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold">Following your plan</p>
          <p className="truncate text-sm text-muted">{data.active.plan.name} · last 4 weeks</p>
        </div>
        <span className="text-2xl text-muted">›</span>
      </div>
      <div className="mt-3 flex items-end gap-4">
        <p className="text-5xl font-bold tabular-nums">{s.score === null ? '—' : pct(s.score)}</p>
        <div className="flex h-12 flex-1 items-end gap-1" aria-hidden>
          {recent.map((w) => (
            <span
              key={w.week}
              className={`flex-1 rounded-t ${w.week === weekOf(data.today) ? 'bg-accent/40' : 'bg-accent'}`}
              style={{ height: `${Math.max(6, w.score * 100)}%` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {s.thisWeek && (
          <span>
            <b>{s.thisWeek.done}</b> of {s.thisWeek.planned} workouts this week
          </span>
        )}
        {s.currentStreak > 0 && (
          <span>
            🔥 <b>{s.currentStreak}</b>-week streak
          </span>
        )}
      </div>
      {s.score === null && (
        <p className="mt-2 text-sm text-muted">Your score appears after your first full week.</p>
      )}
    </Link>
  )
}

/** First view: muscle volume over the last 7 days, tap through for more. */
function MuscleCard({ data }: { data: TrainingData }) {
  const from = addDays(data.today, -6)
  const muscles = musclesFor(
    data.sessions.filter((s) => s.date >= from),
    data.ctx,
    1,
  )
  const low = muscles.filter((m) => m.status === 'low' && m.min > 0)
  return (
    <section className="rounded-3xl bg-surface p-4">
      <Link
        to="/progress/muscles"
        className="mb-2 flex items-start justify-between gap-3 active:opacity-70"
      >
        <div>
          <p className="text-lg font-bold">Muscle volume</p>
          <p className="text-sm text-muted">Working sets in the last 7 days</p>
        </div>
        <span className="text-sm font-semibold text-accent">More ›</span>
      </Link>
      <BodyMap muscles={muscles} />
      {low.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          Could use more:{' '}
          {low
            .map((m) => m.name.toLowerCase())
            .slice(0, 4)
            .join(', ')}
          .
        </p>
      )}
    </section>
  )
}

function Consistency({ data }: { data: TrainingData }) {
  const profile = useProfile()
  const [calRange, setCalRange] = useState<RangeId>('12w')
  const [weekRange, setWeekRange] = useState<RangeId>('12w')
  const earliest = data.sessions[0]?.date ?? null
  const calFrom = rangeStart(calRange, data.today, earliest)
  const byDay = setsPerDay(data.sessions.filter((s) => s.date >= calFrom))
  const target = data.planned.length
    ? data.planned.reduce((a, w) => a + w.perWeek, 0)
    : (profile?.sessions_per_week ?? 4)

  const weekFrom = rangeStart(weekRange, data.today, earliest)
  const weeks = weeksBetween(weekFrom, data.today).map((w) => ({
    week: w,
    count: data.sessions.filter((s) => s.date >= w && s.date <= addDays(w, 6) && s.date >= weekFrom)
      .length,
  }))

  const dayFrom = rangeStart(weekRange, data.today, earliest)
  const byWeekday = DAY.map((d, i) => ({
    d,
    n: data.sessions.filter(
      (s) => s.date >= dayFrom && (new Date(`${s.date}T12:00:00Z`).getUTCDay() + 6) % 7 === i,
    ).length,
  }))

  return (
    <>
      <ChartCard
        title="Training calendar"
        subtitle="Darker = more working sets"
        range={calRange}
        onRange={setCalRange}
        raw={{
          columns: ['Day', 'Working sets'],
          rows: [...byDay].toSorted((a, b) => b[0].localeCompare(a[0])).map(([d, n]) => [d, n]),
        }}
      >
        <CalendarHeatmap setsByDay={byDay} from={calFrom} to={data.today} />
      </ChartCard>

      <ChartCard
        title="Workouts per week"
        subtitle={`Dashed line: your target of ${target}`}
        range={weekRange}
        onRange={setWeekRange}
        raw={{
          columns: ['Week of', 'Workouts', 'Target'],
          rows: weeks.toReversed().map((w) => [w.week, w.count, target]),
        }}
      >
        <BarChart
          label="Workouts per week"
          bars={weeks.map((w) => ({
            key: w.week,
            label: shortDate(w.week),
            values: { n: w.count },
          }))}
          series={[{ id: 'n', name: 'Workouts', colour: 'var(--color-accent)' }]}
          format={(v) => `${Math.round(v)}`}
          target={target}
        />
      </ChartCard>

      <ChartCard
        title="When you train"
        subtitle="Workouts by day of the week (same range as above)"
        raw={{ columns: ['Day', 'Workouts'], rows: byWeekday.map((x) => [x.d, x.n]) }}
      >
        <BarChart
          label="Workouts by weekday"
          bars={byWeekday.map((x) => ({ key: x.d, label: x.d, values: { n: x.n } }))}
          series={[{ id: 'n', name: 'Workouts', colour: 'var(--color-accent)' }]}
          format={(v) => `${Math.round(v)}`}
        />
      </ChartCard>
    </>
  )
}

function Strength({ data }: { data: TrainingData }) {
  const [range, setRange] = useState<RangeId>('12w')
  const from = rangeStart(range, data.today, data.sessions[0]?.date ?? null)
  const top = mostTrained(data.sessions, 8).filter(
    (id) => strengthSeries(data.sessions, id).length > 0,
  )
  const [picked, setPicked] = useState<string | null>(null)
  const exerciseId = picked && top.includes(picked) ? picked : top[0]
  const name = (id: string) => data.ctx.exercises.get(id)?.name ?? 'Exercise'

  // PBs are judged against all history, then filtered to the range
  const series = exerciseId
    ? strengthSeries(data.sessions, exerciseId).filter((p) => p.date >= from)
    : []
  const pbs = recentPbs(data.sessions, top)
    .filter((p) => p.date >= from)
    .slice(0, 6)
  const stalls = top
    .map((id) => exerciseTrend(id, strengthSeries(data.sessions, id)))
    .filter((t) => t?.stalled)

  if (!top.length) {
    return (
      <p className="rounded-2xl bg-surface p-6 text-center text-muted">
        Log some weighted sets to see strength trends.
      </p>
    )
  }
  return (
    <>
      <ChartCard
        title="Estimated 1-rep max"
        subtitle={exerciseId ? `${name(exerciseId)} · ringed points are PBs` : undefined}
        range={range}
        onRange={setRange}
        raw={{
          columns: ['Date', 'Best set', 'Est. 1-rep max', 'PB'],
          rows: series
            .toReversed()
            .map((p) => [p.date, `${p.weightKg} kg × ${p.reps}`, p.e1rm, p.pb ? 'Yes' : '']),
        }}
      >
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {top.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === exerciseId}
              onClick={() => setPicked(id)}
              className={`h-9 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap ${
                id === exerciseId ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted'
              }`}
            >
              {name(id)}
            </button>
          ))}
        </div>
        <LineChart
          label={`Estimated 1-rep max for ${exerciseId ? name(exerciseId) : ''}`}
          points={series.map((p) => ({
            date: p.date,
            value: p.e1rm,
            marker: p.pb,
            note: `${p.weightKg} kg × ${p.reps}`,
          }))}
          format={kg}
        />
      </ChartCard>

      <section className="rounded-3xl bg-surface p-4">
        <h2 className="mb-2 text-lg font-bold">Recent PBs</h2>
        {pbs.length ? (
          <ul className="divide-y divide-border">
            {pbs.map((p) => (
              <li
                key={`${p.exerciseId}${p.date}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">🏆 {name(p.exerciseId)}</span>
                  <span className="block text-sm text-muted">
                    {shortDate(p.date)} · {p.weightKg} kg × {p.reps}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm">
                  <b>{kg(p.e1rm)}</b>
                  <span className="block text-muted">+{p.gain} kg</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No PBs in this range yet — they’ll show up here.</p>
        )}
      </section>

      {stalls.length > 0 && (
        <section className="rounded-3xl bg-surface p-4">
          <h2 className="text-lg font-bold">Worth a nudge</h2>
          <p className="mb-2 text-sm text-muted">
            No new best for a few workouts — completely normal now and then.
          </p>
          <ul className="flex flex-col gap-2">
            {stalls.map((t) => (
              <li key={t!.exerciseId} className="rounded-xl bg-surface-2 p-3 text-sm">
                <b>{name(t!.exerciseId)}</b>: {t!.sinceBest} workouts since your best of{' '}
                {kg(t!.best)}. Try adding a rep before adding weight, or switch to a similar
                variation for a few weeks.
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function Effort({ data }: { data: TrainingData }) {
  const [range, setRange] = useState<RangeId>('12w')
  const from = rangeStart(range, data.today, data.sessions[0]?.date ?? null)
  const stats = sessionStats(data.sessions.filter((s) => s.date >= from))
  const timed = stats.filter((s) => s.minutes !== null)
  const rir = stats.filter((s) => s.avgRir !== null)
  return (
    <>
      <ChartCard
        title="Workout length"
        subtitle="Minutes from start to finish"
        range={range}
        onRange={setRange}
        raw={{
          columns: ['Date', 'Workout', 'Minutes', 'Sets'],
          rows: timed.toReversed().map((s) => [s.date, s.name ?? 'Workout', s.minutes!, s.sets]),
        }}
      >
        <LineChart
          label="Workout length"
          points={timed.map((s) => ({
            date: s.date,
            value: s.minutes!,
            note: s.name ?? undefined,
          }))}
          format={(v) => `${Math.round(v)}m`}
        />
      </ChartCard>
      <ChartCard
        title="How hard you push"
        subtitle="Average reps in reserve per workout — lower is closer to failure"
        range={range}
        onRange={setRange}
        raw={{
          columns: ['Date', 'Workout', 'Avg RIR'],
          rows: rir.toReversed().map((s) => [s.date, s.name ?? 'Workout', s.avgRir!]),
        }}
      >
        <LineChart
          label="Average reps in reserve"
          points={rir.map((s) => ({ date: s.date, value: s.avgRir!, note: s.name ?? undefined }))}
          format={(v) => `${Math.round(v * 10) / 10}`}
          domain={[0, 4]}
        />
      </ChartCard>
    </>
  )
}
