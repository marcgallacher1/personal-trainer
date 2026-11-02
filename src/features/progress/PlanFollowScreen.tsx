import { useState } from 'react'
import { Link } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { BarChart } from '../../components/charts/BarChart'
import { ChartCard, Legend } from '../../components/charts/ChartCard'
import { LineChart } from '../../components/charts/LineChart'
import { shortDate } from '../../components/charts/scales'
import {
  rollingAdherence,
  summariseAdherence,
  weeklyAdherence,
  type ExerciseMatch,
  type WeekAdherence,
} from '../../lib/analysis/adherence'
import { addDays, rangeStart, weekOf, type RangeId } from '../../lib/analysis/training'
import { useTrainingData, type TrainingData } from './data'

const pct = (v: number) => `${Math.round(v * 100)}%`

/** "Following your plan": score, streaks, trend, and each week's workouts with their swaps. */
export function PlanFollowScreen() {
  const data = useTrainingData()
  if (!data) return null
  return (
    <div className="flex flex-col gap-4">
      <BackButton fallback="/progress" label="Progress" />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Following your plan</h1>
        <p className="text-sm text-muted">{data.active?.plan.name ?? 'No active plan'}</p>
      </div>
      {data.active && data.planned.length && data.planSince ? (
        <Detail data={data} since={data.planSince} />
      ) : (
        <p className="rounded-2xl bg-surface p-6 text-center text-muted">
          Switch a plan on in{' '}
          <Link to="/plans" className="font-semibold text-accent">
            Plans
          </Link>{' '}
          to see how closely you’re following it.
        </p>
      )}
    </div>
  )
}

function Detail({ data, since }: { data: TrainingData; since: string }) {
  const [range, setRange] = useState<RangeId>('12w')
  const all = weeklyAdherence(data.planned, data.sessions, data.ctx.exercises, since, data.today)
  const s = summariseAdherence(all, data.today)
  const from = weekOf(rangeStart(range, data.today, since))
  const weeks = all.filter((w) => w.week >= from)
  const current = weekOf(data.today)
  const trend = rollingAdherence(all).filter((w) => w.week >= from && w.week < current)

  return (
    <>
      <section className="grid grid-cols-3 gap-2 text-center">
        <Stat value={s.score === null ? '—' : pct(s.score)} label="last 4 weeks" />
        <Stat value={`${s.currentStreak}`} label={`week streak${s.currentStreak ? ' 🔥' : ''}`} />
        <Stat value={`${s.longestStreak}`} label="longest streak" />
      </section>
      <p className="-mt-1 text-center text-xs text-muted">
        A week counts towards your streak when you do all its planned workouts. Fair swaps (e.g.
        pull-ups for pulldowns) count in full.
      </p>

      <ChartCard
        title="Plan adherence"
        subtitle="Rolling 4-week average"
        range={range}
        onRange={setRange}
        raw={{
          columns: ['Week of', 'That week', '4-week avg'],
          rows: trend
            .toReversed()
            .map((t) => [t.week, pct(all.find((w) => w.week === t.week)!.score), pct(t.value)]),
        }}
      >
        <LineChart
          label="Plan adherence, rolling 4-week average"
          points={trend.map((t) => ({ date: t.week, value: t.value * 100 }))}
          format={(v) => `${Math.round(v)}%`}
          domain={[0, 100]}
        />
      </ChartCard>

      <ChartCard
        title="Workouts per week"
        subtitle="Planned workouts done vs the plan"
        raw={{
          columns: ['Week of', 'Done', 'Planned', 'Score'],
          rows: weeks.toReversed().map((w) => [w.week, w.done, w.planned, pct(w.score)]),
        }}
        legend={
          <Legend
            items={[
              { name: 'Workouts done', colour: 'var(--color-accent)' },
              { name: 'Planned', colour: 'var(--color-text)', dashed: true },
            ]}
          />
        }
      >
        <BarChart
          label="Workouts per week against the plan"
          bars={weeks.map((w) => ({
            key: w.week,
            label: shortDate(w.week),
            values: { n: w.done },
          }))}
          series={[{ id: 'n', name: 'Workouts', colour: 'var(--color-accent)' }]}
          format={(v) => `${Math.round(v)}`}
          target={weeks[0]?.planned}
        />
      </ChartCard>

      <h2 className="mt-2 text-xs font-semibold tracking-wide text-muted uppercase">
        Week by week
      </h2>
      {weeks.toReversed().map((w) => (
        <WeekCard key={w.week} week={w} data={data} current={w.week === current} />
      ))}
    </>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}

function WeekCard({
  week,
  data,
  current,
}: {
  week: WeekAdherence
  data: TrainingData
  current: boolean
}) {
  const [open, setOpen] = useState(current)
  const name = (id: string | null) => (id ? (data.ctx.exercises.get(id)?.name ?? 'Exercise') : '')
  return (
    <section className="rounded-2xl bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-bold">
            {current ? 'This week' : `Week of ${shortDate(week.week)}`}
          </span>
          <span className="block text-sm text-muted">
            {week.done} of {week.planned} workouts{current ? ' so far' : ''}
          </span>
        </span>
        <span className="text-lg font-bold tabular-nums">{pct(week.score)}</span>
        <span className="text-muted">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="flex flex-col gap-3 px-4 pb-4">
          {week.sessions.length === 0 && (
            <li className="text-sm text-muted">No workouts logged.</li>
          )}
          {week.sessions.map((s) => (
            <li key={s.sessionId} className="rounded-xl bg-surface-2 p-3 text-sm">
              <p className="flex justify-between gap-3 font-semibold">
                <span>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][
                    Math.round((Date.parse(s.date) - Date.parse(week.week)) / 86_400_000)
                  ] ?? shortDate(s.date)}{' '}
                  · {s.workoutName ?? 'Extra workout'}
                </span>
                {s.match && <span className="tabular-nums">{pct(s.match.score)}</span>}
              </p>
              {s.match ? (
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {s.match.exercises.map((e) => (
                    <MatchRow key={e.plannedId} e={e} name={name} />
                  ))}
                  {s.match.extras.length > 0 && (
                    <li className="text-muted">+ also did {s.match.extras.map(name).join(', ')}</li>
                  )}
                </ul>
              ) : (
                <p className="text-muted">
                  Didn’t match a workout in your plan — still counts as training.
                </p>
              )}
            </li>
          ))}
          {current && week.done < week.planned && (
            <li className="text-center text-sm text-muted">
              {week.planned - week.done} to go before {shortDate(addDays(week.week, 6))}.
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

function MatchRow({ e, name }: { e: ExerciseMatch; name: (id: string | null) => string }) {
  const sets =
    e.setsDone < e.setsPlanned && e.doneId ? ` (${e.setsDone}/${e.setsPlanned} sets)` : ''
  if (e.kind === 'same') {
    return (
      <li>
        <span className="text-success">✓</span> {name(e.plannedId)}
        <span className="text-muted">{sets}</span>
      </li>
    )
  }
  if (e.kind === 'fair') {
    return (
      <li>
        <span className="text-success">✓</span> {name(e.plannedId)} → {name(e.doneId)}{' '}
        <span className="text-muted">fair swap{sets}</span>
      </li>
    )
  }
  if (e.kind === 'partial') {
    return (
      <li>
        <span className="text-warn">≈</span> {name(e.plannedId)} → {name(e.doneId)}{' '}
        <span className="text-muted">
          similar ({Math.round(e.credit * 100)}% credit){sets}
        </span>
      </li>
    )
  }
  return (
    <li className="text-muted">
      <span>–</span> {name(e.plannedId)} skipped
    </li>
  )
}
