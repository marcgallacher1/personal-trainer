/**
 * A quick review of one workout: starts at 100, and every point off has a "Next time" bullet.
 * Worked out when you open it (nothing is stored), from the workout and your earlier ones.
 */
import { matchWorkout, type PlannedWorkout } from '../analysis/adherence'
import {
  isWorking,
  setsByExercise,
  type ExerciseInfo,
  type TrainingSession,
  type TrainingSet,
} from '../analysis/training'
import { PER_SESSION_MAX } from '../rating/rules'

export interface WorkoutReview {
  score: number
  verdict: string
  good: string[]
  improve: string[]
}

export interface ReviewInput {
  session: TrainingSession
  /** Every logged workout (earlier ones are used for "vs last time") */
  history: readonly TrainingSession[]
  info: ReadonlyMap<string, ExerciseInfo>
  /** The plan workout it was started from, if any */
  planned: PlannedWorkout | null
}

const MAX_BULLETS = 3

/** Best effort for one exercise in a workout: e1RM, or reps for bodyweight moves. */
function best(sets: readonly TrainingSet[]): { value: number; byReps: boolean } | null {
  const working = sets.filter(isWorking)
  if (!working.length) return null
  const weighted = working.filter((s) => s.weightKg > 0)
  if (weighted.length) {
    // Epley past 12 reps is rough as a max, but fine for comparing two workouts
    const v = Math.max(...weighted.map((s) => s.weightKg * (1 + s.reps / 30)))
    if (v > 0) return { value: v, byReps: false }
  }
  return { value: Math.max(...working.map((s) => s.reps)), byReps: true }
}

/**
 * The plan as agreed for this workout: the plan workout minus anything taken off the list.
 * So removing exercises before or during the workout isn't "skipping"; leaving one on the
 * list with no sets is. Null when nothing of the plan is left.
 */
export function agreedPlan(
  planned: PlannedWorkout | null,
  listed: readonly string[] | undefined,
): PlannedWorkout | null {
  if (!planned || !listed) return planned
  const kept = planned.exercises.filter((e) => listed.includes(e.exerciseId))
  return kept.length ? { ...planned, exercises: kept } : null
}

export function verdictForWorkout(score: number): string {
  if (score >= 85) return 'Great session'
  if (score >= 70) return 'Solid session'
  if (score >= 55) return 'Decent session'
  return 'Room to improve'
}

export function reviewWorkout(input: ReviewInput): WorkoutReview | null {
  const { session, history, info } = input
  const planned = agreedPlan(input.planned, session.listed)
  const working = session.sets.filter(isWorking)
  if (!working.length) return null
  const name = (id: string) => info.get(id)?.name ?? 'Exercise'
  const earlier = history.filter((s) => s.startedAt < session.startedAt)

  const good: string[] = []
  // Every point off comes with a reason
  const improve: { text: string; cost: number }[] = []
  const take = (cost: number, text: string) => improve.push({ text, cost: Math.round(cost) })

  // Each exercise vs the last time you did it
  const up: string[] = []
  const same: string[] = []
  const down: string[] = []
  for (const { exerciseId } of setsByExercise(session)) {
    const now = best(session.sets.filter((s) => s.exerciseId === exerciseId))
    const prev = earlier
      .toReversed()
      .map((s) => best(s.sets.filter((x) => x.exerciseId === exerciseId)))
      .find(Boolean)
    if (!now || !prev || now.byReps !== prev.byReps) continue
    if (now.value > prev.value * 1.005) up.push(name(exerciseId))
    else if (now.value < prev.value * 0.95) down.push(name(exerciseId))
    else same.push(name(exerciseId))
  }
  const compared = up.length + same.length + down.length
  if (up.length) good.push(`Beat last time on ${listShort(up)}.`)
  if (!compared) good.push('First time logging these. Next time has something to beat.')
  if (down.length)
    take(
      Math.min(20, down.length * 8),
      `Down on ${listShort(down)} vs last time. Rest longer between sets, or check sleep and food.`,
    )
  if (same.length)
    take(
      Math.min(12, same.length * 4),
      `Same as last time on ${listShort(same)}. Add a rep or a little weight next time.`,
    )

  // Did you do what the plan said?
  if (planned) {
    const match = matchWorkout(planned, setsByExercise(session), info)
    const skipped = match.exercises.filter((e) => e.score === 0).map((e) => name(e.plannedId))
    const short = match.exercises
      .filter((e) => e.score > 0 && e.setsDone < e.setsPlanned)
      .map((e) => name(e.plannedId))
    if (match.score >= 0.95) good.push('Did the full plan.')
    if (skipped.length)
      take(Math.min(25, skipped.length * 8), `Skipped ${listShort(skipped)} from the plan.`)
    if (short.length)
      take(Math.min(10, short.length * 3), `Fewer sets than planned on ${listShort(short)}.`)
  }

  // Too many sets for one muscle in one go
  const perMuscle = new Map<string, number>()
  for (const s of working) {
    for (const m of info.get(s.exerciseId)?.muscles ?? []) {
      if (m.weight >= 1) perMuscle.set(m.muscleId, (perMuscle.get(m.muscleId) ?? 0) + 1)
    }
  }
  if ([...perMuscle.values()].some((n) => n > PER_SESSION_MAX))
    take(
      8,
      `Over ${PER_SESSION_MAX} sets for one muscle. Sets past that add little; spread them across the week.`,
    )

  // Effort, if you logged reps in reserve
  const rirs = working.flatMap((s) => (s.rir === null ? [] : [s.rir]))
  if (rirs.length >= 3) {
    const avg = rirs.reduce((a, b) => a + b, 0) / rirs.length
    if (avg <= 2) good.push('Worked close to failure.')
    else if (avg >= 3) take(8, 'Most sets had 3+ reps left. Push a bit closer to failure.')
  }

  // Length
  const minutes = session.endedAt
    ? (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 60_000
    : null
  if (minutes !== null && minutes > 105 && minutes < 300)
    take(
      5,
      `Long session (${Math.round(minutes)} min). Shorter rests or fewer extras keep quality up.`,
    )

  let score = 100 - improve.reduce((a, x) => a + x.cost, 0)
  score = Math.max(0, Math.min(100, score))
  return {
    score,
    verdict: verdictForWorkout(score),
    good: good.slice(0, MAX_BULLETS),
    // Biggest reasons first
    // All of them, so every point off is explained
    improve: improve.toSorted((a, b) => b.cost - a.cost).map((x) => x.text),
  }
}

/** "A", "A and B", "A, B and 2 more" */
function listShort(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`
}
