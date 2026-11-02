import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/local'
import { requireUserId } from '../../db/user'
import { saveOne } from '../../db/write'
import { addDays, weekOf } from '../../lib/analysis/training'
import {
  buildWeeklyReport,
  reportId,
  type ReportInput,
  type WeeklyReport,
} from '../../lib/report/weekly'
import { isoWeek } from '../../lib/time/london'
import { useProfile } from '../plans/data'
import { rateSavedPlan } from '../plans/rating'
import { useTrainingData } from '../progress/data'

const live = (r: { deleted_at: string | null }) => r.deleted_at === null

export interface Reports {
  today: string
  /** Mondays with a report, newest first */
  weeks: string[]
  build: (week: string) => WeeklyReport
}

/** Builds any week's report from what's on the phone, so it always matches your logs. */
export function useReports(): Reports | undefined {
  const data = useTrainingData()
  const profile = useProfile()
  const nutrition = useLiveQuery(async () => {
    const [protein, weights] = await Promise.all([
      db.protein_logs.toArray(),
      db.bodyweight_logs.orderBy('date').toArray(),
    ])
    return {
      protein: protein.filter(live).map((p) => ({ date: p.date, grams: Number(p.grams) })),
      kg: Number(weights.filter(live).at(-1)?.kg ?? 0) || null,
    }
  }, [])
  if (!data || profile === undefined || !nutrition) return undefined

  const kg = nutrition.kg ?? (Number(profile?.bodyweight_kg ?? 0) || null)
  const plan: ReportInput['plan'] =
    data.active && data.planned.length
      ? {
          id: data.active.plan.id,
          workouts: data.planned,
          since: data.planSince ?? data.today,
          rating: rateSavedPlan(data.active, data.ctx),
        }
      : null
  const base = {
    today: data.today,
    sessions: data.sessions,
    ctx: data.ctx,
    plan,
    protein: {
      logs: nutrition.protein,
      target: kg ? kg * Number(profile?.protein_g_per_kg ?? 1.8) : null,
    },
  }

  // From the first workout (or plan start) to this week
  const current = weekOf(data.today)
  const first = [data.sessions[0]?.date, data.planSince].filter(Boolean).toSorted()[0]
  const weeks: string[] = []
  if (first) for (let w = current; w >= weekOf(first); w = addDays(w, -7)) weeks.push(w)

  return { today: data.today, weeks, build: (week) => buildWeeklyReport({ ...base, week }) }
}

export function useStoredReport(week: string) {
  return useLiveQuery(
    async () =>
      (await db.weekly_reports.where('iso_week').equals(isoWeek(week)).toArray()).find(live) ??
      null,
    [week],
  )
}

/** JSON with sorted keys (the server reorders them). */
function stable(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).toSorted(([a], [b]) => a.localeCompare(b)))
      : x,
  )
}

/** Keeps a copy of the report on the server (for history and the optional AI summary). */
export async function storeReport(report: WeeklyReport): Promise<void> {
  const iso = isoWeek(report.week)
  const existing = (await db.weekly_reports.where('iso_week').equals(iso).toArray()).find(live)
  const { actions, headline, ...stats } = report
  const next = {
    stats_json: stats,
    recommendations_json: actions,
    summary_text: headline,
  }
  if (
    existing &&
    stable([existing.stats_json, existing.recommendations_json, existing.summary_text]) ===
      stable([next.stats_json, next.recommendations_json, next.summary_text])
  )
    return
  await saveOne('weekly_reports', {
    ...(existing ?? {
      id: reportId(requireUserId(), iso),
      user_id: requireUserId(),
      iso_week: iso,
      llm_summary_text: null,
      created_at: new Date().toISOString(),
      deleted_at: null,
    }),
    ...next,
    // Numbers changed, so an old AI summary may be wrong
    ...(existing && { llm_summary_text: null }),
  })
}
