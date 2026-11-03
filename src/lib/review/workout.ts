/**
 * A quick review of one workout: a score out of 100 and a few short bullets.
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

export function verdictForWorkout(score: number): string {
  if (score >= 85) return 'Great session'
  if (score >= 70) return 'Solid session'
  if (score >= 55) return 'Decent session'
  return 'Room to improve'
}

export function reviewWorkout(input: ReviewInput): WorkoutReview | null {
  const { session, history, info, planned } = input
  const working = session.sets.filter(isWorking)
  if (!working.length) return null
  const name = (id: string) => info.get(id)?.name ?? 'Exercise'
  const earlier = history.filter((s) => s.startedAt < session.startedAt)

  const good: string[] = []
  const improve: string[] = []
  let score = 60

  // Each exercise vs the last time you did it
  const up: string[] = []
  const down: string[] = []
  let compared = 0
  for (const { exerciseId } of setsByExercise(session)) {
    const now = best(session.sets.filter((s) => s.exerciseId === exerciseId))
    const prev = earlier
      .toReversed()
      .map((s) => best(s.sets.filter((x) => x.exerciseId === exerciseId)))
      .find(Boolean)
    if (!now || !prev || now.byReps !== prev.byReps) continue
    compared++
    if (now.value > prev.value * 1.005) up.push(name(exerciseId))
    else if (now.value < prev.value * 0.95) down.push(name(exerciseId))
  }
  if (compared) {
    score += Math.round((up.length / compared) * 25) - Math.min(10, down.length * 5)
    if (up.length) good.push(`Beat last time on ${listShort(up)}.`)
    else if (!down.length) good.push('Matched last time on everything. Add a rep next time.')
    if (down.length) improve.push(`Down on ${listShort(down)}. Rest more, or check sleep and food.`)
  } else {
    good.push('First time logging these. Next time has something to beat.')
  }

  // Did you do what the plan said?
  if (planned) {
    const match = matchWorkout(planned, setsByExercise(session), info)
    score += Math.round((match.score - 0.7) * 30)
    const skipped = match.exercises.filter((e) => e.score === 0).map((e) => name(e.plannedId))
    if (match.score >= 0.9) good.push('Did the full plan.')
    else if (skipped.length) improve.push(`Skipped ${listShort(skipped)} from the plan.`)
  }

  // Too many sets for one muscle in one go
  const perMuscle = new Map<string, number>()
  for (const s of working) {
    for (const m of info.get(s.exerciseId)?.muscles ?? []) {
      if (m.weight >= 1) perMuscle.set(m.muscleId, (perMuscle.get(m.muscleId) ?? 0) + 1)
    }
  }
  const heavy = [...perMuscle].filter(([, n]) => n > PER_SESSION_MAX)
  if (heavy.length) {
    score -= 8
    improve.push(
      `${heavy.length === 1 ? 'One muscle' : 'Some muscles'} got over ${PER_SESSION_MAX} sets. Extra sets past that add little; spread them across the week.`,
    )
  }

  // Effort, if you logged reps in reserve
  const rirs = working.flatMap((s) => (s.rir === null ? [] : [s.rir]))
  if (rirs.length >= 3) {
    const avg = rirs.reduce((a, b) => a + b, 0) / rirs.length
    if (avg <= 2) {
      score += 5
      good.push('Worked close to failure.')
    } else if (avg >= 3) {
      score -= 5
      improve.push('Most sets had 3+ reps left. Push a bit closer to failure.')
    }
  }

  // Length
  const minutes = session.endedAt
    ? (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 60_000
    : null
  if (minutes !== null && minutes > 0 && minutes < 300) {
    if (minutes > 105)
      improve.push(
        `Long session (${Math.round(minutes)} min). Shorter rests or fewer extras keep quality up.`,
      )
  }

  score = Math.max(0, Math.min(100, score))
  return {
    score,
    verdict: verdictForWorkout(score),
    good: good.slice(0, MAX_BULLETS),
    improve: improve.slice(0, MAX_BULLETS),
  }
}

/** "A", "A and B", "A, B and 2 more" */
function listShort(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`
}
