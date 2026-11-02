/** Turns a saved plan, or logged workouts, into the rating engine's input. */
import type { TargetLike } from '../plans/targets'
import type { RatingWorkout } from './rate'

interface PlanLike {
  sessions: readonly { id: string; name: string; deleted_at: string | null }[]
  schedule: readonly {
    plan_session_id: string | null
    weekday: number | null
    deleted_at: string | null
  }[]
  exercises: readonly {
    id: string
    plan_session_id: string
    exercise_id: string
    order: number
    group_id?: string | null
    deleted_at: string | null
  }[]
  targets: readonly (TargetLike & {
    plan_exercise_id: string
    order: number
    deleted_at: string | null
  })[]
}

/** A plan's projected week. A workout with no days set counts as once a week. */
export function planWorkouts(plan: PlanLike): RatingWorkout[] {
  return plan.sessions
    .filter((s) => !s.deleted_at)
    .map((s) => {
      const days = [
        ...new Set(
          plan.schedule
            .filter((d) => !d.deleted_at && d.plan_session_id === s.id && d.weekday !== null)
            .map((d) => d.weekday!),
        ),
      ].toSorted((a, b) => a - b)
      return {
        id: s.id,
        name: s.name,
        timesPerWeek: Math.max(1, days.length),
        days,
        exercises: plan.exercises
          .filter((e) => !e.deleted_at && e.plan_session_id === s.id)
          .toSorted((a, b) => a.order - b.order)
          .map((e) => ({
            id: e.id,
            exerciseId: e.exercise_id,
            groupId: e.group_id ?? null,
            sets: plan.targets
              .filter((t) => !t.deleted_at && t.plan_exercise_id === e.id)
              .toSorted((a, b) => a.order - b.order),
          })),
      }
    })
}

export interface LoggedSet {
  session_id: string
  exercise_id: string
  reps: number
  rir: number | null
  set_type: string
}

export interface LoggedSession {
  id: string
  name: string | null
  /** London date, YYYY-MM-DD */
  date: string
}

const dayNumber = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000)

/** Logged workouts from the last few weeks, averaged per week. */
export function loggedWorkouts(
  sessions: readonly LoggedSession[],
  sets: readonly LoggedSet[],
  today: string,
  maxWeeks = 4,
): { workouts: RatingWorkout[]; weeks: number } {
  const end = dayNumber(today)
  const start = end - maxWeeks * 7 + 1
  const recent = sessions.filter((s) => {
    const d = dayNumber(s.date)
    return d >= start && d <= end
  })
  if (!recent.length) return { workouts: [], weeks: maxWeeks }
  const first = Math.min(...recent.map((s) => dayNumber(s.date)))
  const weeks = Math.min(maxWeeks, Math.max(1, (end - first + 1) / 7))
  const workouts = recent.map((s) => {
    const byExercise = new Map<string, TargetLike[]>()
    for (const set of sets) {
      if (set.session_id !== s.id) continue
      const list = byExercise.get(set.exercise_id) ?? []
      list.push({
        set_type: set.set_type,
        reps_min: set.reps,
        reps_max: set.reps,
        seconds_min: null,
        seconds_max: null,
        target_rir: set.rir,
      })
      byExercise.set(set.exercise_id, list)
    }
    return {
      id: s.id,
      name: s.name ?? 'Workout',
      timesPerWeek: 1 / weeks,
      days: [dayNumber(s.date)],
      exercises: [...byExercise].map(([exerciseId, list]) => ({
        id: `${s.id}:${exerciseId}`,
        exerciseId,
        sets: list,
      })),
    }
  })
  return { workouts: workouts.filter((w) => w.exercises.length), weeks }
}
