/** Best e1RM per workout, PBs, and stalls (no new best in 3+ workouts). */
import { e1rm } from './e1rm'
import { isWorking, type TrainingSession } from './training'

export interface StrengthPoint {
  date: string
  sessionId: string
  /** Best e1RM that workout, kg (1 dp) */
  e1rm: number
  /** The set it came from */
  weightKg: number
  reps: number
  /** A new best compared with every earlier workout (the first workout doesn't count) */
  pb: boolean
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** One point per workout that included the exercise with an e1RM-able set (1–12 reps). */
export function strengthSeries(
  sessions: readonly TrainingSession[],
  exerciseId: string,
): StrengthPoint[] {
  const out: StrengthPoint[] = []
  let best = 0
  for (const s of sessions.toSorted((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    let top: { v: number; w: number; r: number } | null = null
    for (const set of s.sets) {
      if (set.exerciseId !== exerciseId || !isWorking(set)) continue
      const v = e1rm(set.weightKg, set.reps)
      if (v !== null && (!top || v > top.v)) top = { v, w: set.weightKg, r: set.reps }
    }
    if (!top) continue
    out.push({
      date: s.date,
      sessionId: s.id,
      e1rm: r1(top.v),
      weightKg: top.w,
      reps: top.r,
      pb: out.length > 0 && top.v > best + 1e-9,
    })
    best = Math.max(best, top.v)
  }
  return out
}

export interface ExerciseTrend {
  exerciseId: string
  workouts: number
  latest: number
  best: number
  /** Change in e1RM from the first to the latest workout in the series, % */
  changePct: number
  /** No new best in the last `STALL_AFTER` workouts */
  stalled: boolean
  /** Workouts since the last best */
  sinceBest: number
}

export const STALL_AFTER = 3

export function exerciseTrend(
  exerciseId: string,
  series: readonly StrengthPoint[],
): ExerciseTrend | null {
  const first = series[0]
  const last = series.at(-1)
  if (!first || !last) return null
  let bestIdx = 0
  series.forEach((p, i) => {
    if (p.e1rm > series[bestIdx]!.e1rm) bestIdx = i
  })
  const sinceBest = series.length - 1 - bestIdx
  return {
    exerciseId,
    workouts: series.length,
    latest: last.e1rm,
    best: series[bestIdx]!.e1rm,
    changePct: Math.round(((last.e1rm - first.e1rm) / first.e1rm) * 1000) / 10,
    stalled: series.length > STALL_AFTER && sinceBest >= STALL_AFTER,
    sinceBest,
  }
}

export interface PbEvent {
  exerciseId: string
  date: string
  e1rm: number
  weightKg: number
  reps: number
  /** How much it beat the previous best by, kg */
  gain: number
}

/** Every e1RM PB across exercises, newest first. */
export function recentPbs(
  sessions: readonly TrainingSession[],
  exerciseIds: Iterable<string>,
): PbEvent[] {
  const out: PbEvent[] = []
  for (const id of exerciseIds) {
    const series = strengthSeries(sessions, id)
    let best = series[0]?.e1rm ?? 0
    for (const p of series.slice(1)) {
      if (p.pb) {
        out.push({
          exerciseId: id,
          date: p.date,
          e1rm: p.e1rm,
          weightKg: p.weightKg,
          reps: p.reps,
          gain: r1(p.e1rm - best),
        })
      }
      best = Math.max(best, p.e1rm)
    }
  }
  return out.toSorted((a, b) => b.date.localeCompare(a.date) || b.gain - a.gain)
}

/** Exercises done most often (by workouts), for picking which charts to show first. */
export function mostTrained(sessions: readonly TrainingSession[], limit = 8): string[] {
  const counts = new Map<string, number>()
  for (const s of sessions) {
    for (const id of new Set(s.sets.filter(isWorking).map((x) => x.exerciseId))) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return [...counts]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)
}
