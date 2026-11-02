/** Weekly sets per muscle for logged workouts, scored against your targets. */
import { ratePlan, type Focus, type MuscleGoal, type MuscleVolume } from '../rating/rate'
import { dayNumber, type ExerciseInfo, type TrainingSession } from './training'

export interface MuscleContext {
  exercises: ReadonlyMap<string, ExerciseInfo>
  muscles: readonly MuscleGoal[]
  focus: Focus | null
}

/** Sets per muscle as a weekly figure over `weeks` weeks. */
export function actualMuscles(
  sessions: readonly TrainingSession[],
  ctx: MuscleContext,
  weeks: number,
): MuscleVolume[] {
  return ratePlan({
    mode: 'actual',
    weeks,
    exercises: ctx.exercises,
    muscles: ctx.muscles,
    focus: ctx.focus,
    workouts: sessions.map((s) => {
      const byExercise = new Map<
        string,
        {
          set_type: string
          reps_min: number
          reps_max: number
          seconds_min: null
          seconds_max: null
          target_rir: number | null
        }[]
      >()
      for (const x of s.sets) {
        const list = byExercise.get(x.exerciseId) ?? []
        list.push({
          set_type: x.setType,
          reps_min: x.reps,
          reps_max: x.reps,
          seconds_min: null,
          seconds_max: null,
          target_rir: x.rir,
        })
        byExercise.set(x.exerciseId, list)
      }
      return {
        id: s.id,
        name: s.name ?? 'Workout',
        timesPerWeek: 1 / weeks,
        // Real dates, to spot back-to-back days
        days: [dayNumber(s.date)],
        exercises: [...byExercise].map(([exerciseId, sets]) => ({
          id: `${s.id}:${exerciseId}`,
          exerciseId,
          sets,
        })),
      }
    }),
  }).muscles
}
