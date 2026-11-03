/** How closely you follow your plan. Fair swaps (e.g. pull-up for pulldown) count in full. */
import {
  addDays,
  setsByExercise,
  weekOf,
  weeksBetween,
  type ExerciseInfo,
  type TrainingSession,
} from './training'

export type SwapKind = 'same' | 'fair' | 'partial' | 'none'

/** Weighted overlap of two exercises' muscles, 0–1. */
function overlap(a: ExerciseInfo, b: ExerciseInfo): number {
  const ids = new Set([...a.muscles, ...b.muscles].map((m) => m.muscleId))
  let shared = 0
  let total = 0
  for (const id of ids) {
    const wa = a.muscles.find((m) => m.muscleId === id)?.weight ?? 0
    const wb = b.muscles.find((m) => m.muscleId === id)?.weight ?? 0
    shared += Math.min(wa, wb)
    total += Math.max(wa, wb)
  }
  return total ? shared / total : 0
}

const primaries = (e: ExerciseInfo) => e.muscles.filter((m) => m.weight >= 1).map((m) => m.muscleId)

/** How much credit doing `done` gets in place of `planned` (1 = as good as the real thing). */
export function swapCredit(
  planned: ExerciseInfo,
  done: ExerciseInfo,
): { credit: number; kind: SwapKind } {
  if (planned.id === done.id) return { credit: 1, kind: 'same' }
  const o = overlap(planned, done)
  const samePrimary = primaries(planned).some((m) => primaries(done).includes(m))
  if (samePrimary && planned.pattern === done.pattern && o >= 0.5)
    return { credit: 1, kind: 'fair' }
  if (samePrimary) return { credit: Math.round((0.5 + 0.25 * o) * 100) / 100, kind: 'partial' }
  if (o > 0) return { credit: Math.round(0.4 * o * 100) / 100, kind: 'partial' }
  return { credit: 0, kind: 'none' }
}

export interface PlannedWorkout {
  id: string
  name: string
  /** Times a week (days it's on, or 1 if it has no set day) */
  perWeek: number
  /** ISO weekdays it's on, if set (lets a part week count only what was due) */
  days?: readonly number[]
  exercises: readonly { exerciseId: string; sets: number }[]
}

export interface ExerciseMatch {
  plannedId: string
  doneId: string | null
  kind: SwapKind
  credit: number
  setsPlanned: number
  setsDone: number
  /** credit × share of planned sets done */
  score: number
}

export interface WorkoutMatch {
  score: number
  exercises: ExerciseMatch[]
  /** Logged exercises that didn't stand in for anything planned */
  extras: string[]
}

/** Matches a logged workout to a planned one, exercise by exercise. */
export function matchWorkout(
  planned: PlannedWorkout,
  done: readonly { exerciseId: string; sets: number }[],
  info: ReadonlyMap<string, ExerciseInfo>,
): WorkoutMatch {
  const pairs: { p: number; d: number; credit: number; kind: SwapKind }[] = []
  planned.exercises.forEach((pe, p) => {
    const pi = info.get(pe.exerciseId)
    done.forEach((de, d) => {
      const di = info.get(de.exerciseId)
      const c =
        pe.exerciseId === de.exerciseId
          ? { credit: 1, kind: 'same' as const }
          : pi && di
            ? swapCredit(pi, di)
            : { credit: 0, kind: 'none' as const }
      if (c.credit > 0) pairs.push({ p, d, ...c })
    })
  })
  // Best pairings first; exact matches win ties
  pairs.sort((a, b) => b.credit - a.credit || Number(b.kind === 'same') - Number(a.kind === 'same'))
  const byPlanned = new Map<number, (typeof pairs)[number]>()
  const usedDone = new Set<number>()
  for (const pair of pairs) {
    if (byPlanned.has(pair.p) || usedDone.has(pair.d)) continue
    byPlanned.set(pair.p, pair)
    usedDone.add(pair.d)
  }
  const exercises = planned.exercises.map((pe, p): ExerciseMatch => {
    const pair = byPlanned.get(p)
    const setsDone = pair ? (done[pair.d]?.sets ?? 0) : 0
    const credit = pair?.credit ?? 0
    return {
      plannedId: pe.exerciseId,
      doneId: pair ? (done[pair.d]?.exerciseId ?? null) : null,
      kind: pair?.kind ?? 'none',
      credit,
      setsPlanned: pe.sets,
      setsDone,
      score: credit * (pe.sets ? Math.min(1, setsDone / pe.sets) : 1),
    }
  })
  const score = exercises.length ? exercises.reduce((a, e) => a + e.score, 0) / exercises.length : 1
  return {
    score,
    exercises,
    extras: done.filter((_, d) => !usedDone.has(d)).map((d) => d.exerciseId),
  }
}

export interface SessionAdherence {
  sessionId: string
  date: string
  workoutId: string | null
  workoutName: string | null
  match: WorkoutMatch | null
}

export interface WeekAdherence {
  week: string
  planned: number
  /** Planned workouts due so far: the full week once it's over, fewer in a part week */
  due: number
  /** Workouts logged that week */
  done: number
  /** 0–1: due workouts done, weighted by how closely each matched */
  score: number
  sessions: SessionAdherence[]
}

/** A logged workout counts towards a plan workout if it matches it at least this well. */
const MIN_MATCH = 0.3

/** Adherence per week: each logged workout fills the planned slot it matches best. */
export function weeklyAdherence(
  plan: readonly PlannedWorkout[],
  sessions: readonly TrainingSession[],
  info: ReadonlyMap<string, ExerciseInfo>,
  from: string,
  to: string,
): WeekAdherence[] {
  const slotsPerWeek = plan.reduce((a, w) => a + w.perWeek, 0)
  return weeksBetween(from, to).map((week) => {
    const end = addDays(week, 6)
    const inWeek = sessions.filter(
      (s) => s.date >= week && s.date <= end && s.date >= from && s.date <= to,
    )
    const candidates = inWeek.flatMap((s) => {
      const done = setsByExercise(s)
      return plan.map((w) => {
        const match = matchWorkout(w, done, info)
        // Started from this plan workout: trust that, even if it went off-script
        const chosen = s.planSessionId === w.id
        return { s, w, match, rank: match.score + (chosen ? 1 : 0) }
      })
    })
    candidates.sort((a, b) => b.rank - a.rank)
    const left = new Map(plan.map((w) => [w.id, w.perWeek]))
    const assigned = new Map<string, SessionAdherence>()
    for (const c of candidates) {
      if (assigned.has(c.s.id) || (left.get(c.w.id) ?? 0) <= 0) continue
      if (c.match.score < MIN_MATCH && c.s.planSessionId !== c.w.id) continue
      left.set(c.w.id, (left.get(c.w.id) ?? 0) - 1)
      assigned.set(c.s.id, {
        sessionId: c.s.id,
        date: c.s.date,
        workoutId: c.w.id,
        workoutName: c.w.name,
        match: c.match,
      })
    }
    const list = inWeek
      .toSorted((a, b) => a.date.localeCompare(b.date))
      .map(
        (s) =>
          assigned.get(s.id) ?? {
            sessionId: s.id,
            date: s.date,
            workoutId: null,
            workoutName: null,
            match: null,
          },
      )
    const earned = [...assigned.values()].reduce((a, x) => a + (x.match?.score ?? 0), 0)
    const due = dueIn(plan, week, from, to)
    return {
      week,
      planned: slotsPerWeek,
      due,
      done: inWeek.length,
      score: due ? Math.min(1, earned / due) : 0,
      sessions: list,
    }
  })
}

/**
 * Week 1 of a plan: the Monday of the week you first trained on it (so a missed day earlier
 * that week still counts), but never before the plan existed. Empty weeks before don't count.
 */
export function planStart(firstWorkout: string | null, created: string | null): string | null {
  if (!firstWorkout) return created
  const monday = weekOf(firstWorkout)
  if (!created) return monday
  return created > monday ? (created < firstWorkout ? created : firstWorkout) : monday
}

/** Workouts due in a week between `from` and `to` (both inclusive). */
function dueIn(plan: readonly PlannedWorkout[], week: string, from: string, to: string): number {
  const end = addDays(week, 6)
  let due = 0
  for (const w of plan) {
    if (w.days?.length) {
      due += w.days.filter((d) => {
        const date = addDays(week, d - 1)
        return date >= from && date <= to
      }).length
    } else if (end <= to && week >= weekOf(from)) {
      // No set day: due by the end of the week
      due += w.perWeek
    }
  }
  return due
}

export interface AdherenceSummary {
  /** Average of finished weeks in the window, or this week so far if none are finished (0–1) */
  score: number | null
  /** What the score covers: finished weeks, or just this week so far */
  basis: { kind: 'weeks'; count: number } | { kind: 'this-week' } | null
  thisWeek: WeekAdherence | null
  currentStreak: number
  longestStreak: number
}

/** A streak week = all planned workouts done. This week counts once it's hit. */
export function summariseAdherence(
  weeks: readonly WeekAdherence[],
  today: string,
  window = 4,
): AdherenceSummary {
  const current = weekOf(today)
  const finished = weeks.filter((w) => w.week < current)
  const thisWeek = weeks.find((w) => w.week === current) ?? null
  const recent = finished.slice(-window)
  const hit = (w: WeekAdherence) => w.planned > 0 && w.done >= w.planned

  let longest = 0
  let run = 0
  for (const w of weeks) {
    if (w.week > current) break
    if (hit(w)) longest = Math.max(longest, ++run)
    else if (w.week < current) run = 0
  }
  let streak = 0
  for (let i = finished.length - 1; i >= 0 && hit(finished[i]!); i--) streak++
  if (thisWeek && hit(thisWeek)) streak++

  const soFar = thisWeek && thisWeek.due > 0 ? thisWeek.score : null
  return {
    score: recent.length ? recent.reduce((a, w) => a + w.score, 0) / recent.length : soFar,
    basis: recent.length
      ? { kind: 'weeks', count: recent.length }
      : soFar !== null
        ? { kind: 'this-week' }
        : null,
    thisWeek,
    currentStreak: streak,
    longestStreak: Math.max(longest, streak),
  }
}

/** "this week so far", "last week", "last 3 weeks" */
export function basisLabel(basis: AdherenceSummary['basis']): string {
  if (!basis) return 'nothing due yet'
  if (basis.kind === 'this-week') return 'this week so far'
  return basis.count === 1 ? 'last week' : `last ${basis.count} weeks`
}

/** Rolling average of weekly adherence (for the trend line). */
export function rollingAdherence(
  weeks: readonly WeekAdherence[],
  window = 4,
): { week: string; value: number }[] {
  return weeks.map((w, i) => {
    const slice = weeks.slice(Math.max(0, i - window + 1), i + 1)
    return { week: w.week, value: slice.reduce((a, x) => a + x.score, 0) / slice.length }
  })
}
