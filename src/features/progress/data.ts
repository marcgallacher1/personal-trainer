import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/local'
import type { PlannedWorkout } from '../../lib/analysis/adherence'
import { dayNumber, type TrainingSession } from '../../lib/analysis/training'
import { planWorkouts } from '../../lib/rating/inputs'
import { ratePlan, type MuscleVolume } from '../../lib/rating/rate'
import { londonDate } from '../log/format'
import { usePlanLibrary, type PlanWithVersions } from '../plans/data'
import { useRatingContext, type RatingContext } from '../plans/rating'

const live = (r: { deleted_at: string | null }) => r.deleted_at === null

export interface TrainingData {
  sessions: TrainingSession[]
  ctx: RatingContext
  today: string
  active: PlanWithVersions | null
  /** The active plan's workouts, for adherence */
  planned: PlannedWorkout[]
  /** First day adherence is measured from: when you started using the active plan */
  planSince: string | null
}

/** Every logged workout (with at least one set) plus what's needed to analyse it. */
export function useTrainingData(): TrainingData | undefined {
  const ctx = useRatingContext()
  const library = usePlanLibrary()
  const logged = useLiveQuery(async () => {
    const [sessions, sets] = await Promise.all([db.sessions.toArray(), db.sets.toArray()])
    const bySession = new Map<string, TrainingSession['sets']>()
    for (const s of sets) {
      if (!live(s)) continue
      const list = bySession.get(s.session_id) ?? []
      list.push({
        exerciseId: s.exercise_id,
        weightKg: Number(s.weight_kg),
        reps: s.reps,
        seconds: s.duration_seconds,
        setType: s.set_type,
        rir: s.rir,
      })
      bySession.set(s.session_id, list)
    }
    return {
      today: londonDate(new Date().toISOString()),
      sessions: sessions
        .filter((s) => live(s) && bySession.has(s.id))
        .map((s): TrainingSession => ({
          id: s.id,
          date: londonDate(s.started_at),
          startedAt: s.started_at,
          endedAt: s.ended_at,
          name: s.name,
          planId: s.plan_id,
          planSessionId: s.plan_session_id,
          sets: bySession.get(s.id) ?? [],
        }))
        .toSorted((a, b) => a.startedAt.localeCompare(b.startedAt)),
    }
  }, [])
  if (!ctx || !library || !logged) return undefined

  const active = library.find((p) => p.plan.is_active) ?? null
  const planned: PlannedWorkout[] = active
    ? planWorkouts({ ...active, sessions: active.versions }).map((w) => ({
        id: w.id,
        name: w.name,
        perWeek: w.timesPerWeek,
        exercises: w.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          sets: e.sets.filter((t) => t.set_type !== 'warmup').length,
        })),
      }))
    : []
  const firstOnPlan = active
    ? logged.sessions.find((s) => s.planId === active.plan.id)?.date
    : undefined
  const created = active ? londonDate(active.plan.created_at) : null
  const planSince =
    created && firstOnPlan ? (firstOnPlan < created ? firstOnPlan : created) : (created ?? null)

  return { sessions: logged.sessions, ctx, today: logged.today, active, planned, planSince }
}

/** Muscle-by-muscle sets for some workouts, as weekly figures against your targets. */
export function musclesFor(
  sessions: readonly TrainingSession[],
  ctx: RatingContext,
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
