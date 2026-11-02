import { useState } from 'react'
import { BackButton } from '../../components/BackButton'
import { BarChart } from '../../components/charts/BarChart'
import { ChartCard, Legend } from '../../components/charts/ChartCard'
import { RadarChart } from '../../components/charts/RadarChart'
import { shortDate } from '../../components/charts/scales'
import {
  addDays,
  rangeStart,
  weekOf,
  weeksBetween,
  type RangeId,
} from '../../lib/analysis/training'
import { MUSCLE_GROUPS, weeklyVolume } from '../../lib/analysis/volume'
import type { MuscleVolume } from '../../lib/rating/rate'
import { BodyMap } from '../plans/BodyMap'
import { rateSavedPlan } from '../plans/rating'
import { musclesFor, useTrainingData, type TrainingData } from './data'

const GROUP_COLOURS: Record<string, string> = {
  chest: 'var(--color-series-1)',
  shoulders: 'var(--color-series-2)',
  back: 'var(--color-series-3)',
  arms: 'var(--color-series-4)',
  core: 'var(--color-series-5)',
  legs: 'var(--color-series-6)',
}
const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))

/** Weekly sets summed per muscle group */
const byGroup = (ms: MuscleVolume[]) =>
  Object.fromEntries(
    MUSCLE_GROUPS.map((g) => [
      g.id,
      Math.round(
        ms
          .filter((m) => (g.muscles as readonly string[]).includes(m.id))
          .reduce((a, m) => a + m.sets, 0) * 2,
      ) / 2,
    ]),
  )

/** Muscle volume in depth: any week's heatmap, weekly sets by muscle group, plan vs actual. */
export function MuscleScreen() {
  const data = useTrainingData()
  if (!data) return null
  return (
    <div className="flex flex-col gap-4">
      <BackButton fallback="/progress" label="Progress" />
      <h1 className="text-3xl font-bold tracking-tight">Muscle volume</h1>
      <WeekView data={data} />
      <WeeklyGroups data={data} />
      <PlanVsActual data={data} />
    </div>
  )
}

function WeekView({ data }: { data: TrainingData }) {
  const current = weekOf(data.today)
  // Open on last week until this week has a workout in it
  const [week, setWeek] = useState(() =>
    data.sessions.some((s) => s.date >= current) ? current : addDays(current, -7),
  )
  const end = addDays(week, 6)
  const muscles = musclesFor(
    data.sessions.filter((s) => s.date >= week && s.date <= end),
    data.ctx,
    1,
  )
  const first = weekOf(data.sessions[0]?.date ?? data.today)
  return (
    <ChartCard
      title={week === current ? 'This week so far' : `Week of ${shortDate(week)}`}
      subtitle="Working sets per muscle (secondary muscles count half)"
      raw={{
        columns: ['Muscle', 'Sets', 'Aim', 'Status'],
        rows: muscles.map((m) => [m.name, m.sets, `${m.min}–${m.max}`, statusText(m)]),
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          disabled={week <= first}
          onClick={() => setWeek(addDays(week, -7))}
          className="h-10 rounded-xl bg-surface-2 px-4 font-semibold disabled:opacity-40"
        >
          ‹ Earlier
        </button>
        <button
          type="button"
          disabled={week >= current}
          onClick={() => setWeek(addDays(week, 7))}
          className="h-10 rounded-xl bg-surface-2 px-4 font-semibold disabled:opacity-40"
        >
          Later ›
        </button>
      </div>
      <BodyMap muscles={muscles} />
      <ul className="mt-3 divide-y divide-border text-sm">
        {muscles
          .filter((m) => !m.paused)
          .map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-1.5">
              <span className="w-32 shrink-0 truncate">{m.name}</span>
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span
                  className={`absolute inset-y-0 left-0 rounded-full ${
                    m.status === 'low' ? 'bg-warn' : m.status === 'high' ? 'bg-danger' : 'bg-accent'
                  }`}
                  style={{ width: `${Math.min(100, (m.sets / Math.max(1, m.max)) * 100)}%` }}
                />
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums">
                {fmt(m.sets)}
                {m.min > 0 && <span className="text-muted">/{m.min}</span>}
              </span>
            </li>
          ))}
      </ul>
    </ChartCard>
  )
}

function statusText(m: MuscleVolume): string {
  if (m.paused) return 'Paused'
  if (m.status === 'low') return 'Could use more'
  if (m.status === 'high') return 'A lot'
  return 'In range'
}

function WeeklyGroups({ data }: { data: TrainingData }) {
  const [range, setRange] = useState<RangeId>('12w')
  const from = rangeStart(range, data.today, data.sessions[0]?.date ?? null)
  const weeks = weeklyVolume(data.sessions, data.ctx.exercises, weeksBetween(from, data.today))
  const series = MUSCLE_GROUPS.map((g) => ({
    id: g.id,
    name: g.name,
    colour: GROUP_COLOURS[g.id]!,
  }))
  return (
    <>
      <ChartCard
        title="Weekly sets by muscle group"
        range={range}
        onRange={setRange}
        raw={{
          columns: ['Week of', ...MUSCLE_GROUPS.map((g) => g.name), 'Total sets'],
          rows: weeks
            .toReversed()
            .map((w) => [w.week, ...MUSCLE_GROUPS.map((g) => w.groups[g.id]), w.sets]),
        }}
        legend={<Legend items={series} />}
      >
        <BarChart
          label="Weekly sets by muscle group"
          bars={weeks.map((w) => ({ key: w.week, label: shortDate(w.week), values: w.groups }))}
          series={series}
          format={(v) => fmt(Math.round(v * 2) / 2)}
        />
      </ChartCard>
      <ChartCard
        title="Weekly tonnage"
        subtitle="Weight × reps over working sets"
        range={range}
        onRange={setRange}
        raw={{
          columns: ['Week of', 'Tonnage (kg)'],
          rows: weeks.toReversed().map((w) => [w.week, w.tonnage]),
        }}
      >
        <BarChart
          label="Weekly tonnage"
          bars={weeks.map((w) => ({
            key: w.week,
            label: shortDate(w.week),
            values: { t: w.tonnage },
          }))}
          series={[{ id: 't', name: 'Tonnage', colour: 'var(--color-accent)' }]}
          format={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}t` : `${Math.round(v)}kg`)}
        />
      </ChartCard>
    </>
  )
}

function PlanVsActual({ data }: { data: TrainingData }) {
  if (!data.active) return null
  const planned = rateSavedPlan(data.active, data.ctx).muscles
  const actual = musclesFor(
    data.sessions.filter((s) => s.date > addDays(data.today, -28)),
    data.ctx,
    4,
  )
  const p = byGroup(planned)
  const a = byGroup(actual)
  // Leave out groups that are entirely paused
  const axes = MUSCLE_GROUPS.filter((g) =>
    g.muscles.some((id) => !planned.find((m) => m.id === id)?.paused),
  )
  return (
    <ChartCard
      title="Plan vs what you did"
      subtitle="Weekly sets by muscle group · last 4 weeks"
      raw={{
        columns: ['Group', 'Planned', 'Did (avg/week)'],
        rows: axes.map((g) => [g.name, p[g.id] ?? 0, a[g.id] ?? 0]),
      }}
      legend={
        <Legend
          items={[
            { name: 'Planned', colour: 'var(--color-series-1)', dashed: true },
            { name: 'What you did', colour: 'var(--color-series-2)' },
          ]}
        />
      }
    >
      <RadarChart
        label="Planned versus actual weekly sets by muscle group"
        axes={axes.map((g) => ({ id: g.id, label: g.name }))}
        series={[
          { name: 'Planned', colour: 'var(--color-series-1)', values: p, dashed: true },
          { name: 'What you did', colour: 'var(--color-series-2)', values: a },
        ]}
      />
    </ChartCard>
  )
}
