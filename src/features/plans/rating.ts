import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/local'
import { save, saveOne, type Change } from '../../db/write'
import { useExerciseMuscleMap, useExercises, useMuscles } from '../../db/queries'
import { asLogType } from '../../lib/logging/logTypes'
import type { PlanRows } from '../../lib/plans/instantiate'
import { withWorkingSets } from '../../lib/plans/targets'
import { loggedWorkouts, planWorkouts } from '../../lib/rating/inputs'
import {
  ratePlan,
  type Fix,
  type Focus,
  type MuscleGoal,
  type Rating,
  type RatingExercise,
} from '../../lib/rating/rate'
import { londonDate } from '../log/format'
import {
  addPlanExercise,
  defaultTargets,
  setTargets,
  snapshotIfChanged,
  useMuscleTargets,
  useProfile,
  type PlanWithVersions,
} from './data'

const live = (r: { deleted_at: string | null }) => r.deleted_at === null

/** Everything a rating needs besides the workouts: the catalogue, your muscle goals, your focus. */
export interface RatingContext {
  exercises: Map<string, RatingExercise>
  muscles: MuscleGoal[]
  focus: Focus | null
}

export function useRatingContext(): RatingContext | undefined {
  const exercises = useExercises()
  const muscleMap = useExerciseMuscleMap()
  const muscles = useMuscles()
  const targets = useMuscleTargets()
  const profile = useProfile()
  if (!exercises || !muscleMap || !muscles || !targets || profile === undefined) return undefined
  return {
    exercises: new Map(
      exercises.map((e) => [
        e.id,
        {
          id: e.id,
          name: e.name,
          pattern: e.pattern,
          isCompound: e.is_compound,
          logType: asLogType(e.log_type),
          restSeconds: e.default_rest_seconds,
          muscles: (muscleMap.get(e.id) ?? []).map((m) => ({
            muscleId: m.muscle_id,
            weight: Number(m.weight),
          })),
        },
      ]),
    ),
    muscles: muscles
      .toSorted((a, b) => a.sort_order - b.sort_order)
      .map((m) => {
        const t = targets.find((x) => x.muscle_id === m.id)
        return {
          id: m.id,
          name: m.name,
          min: Number(t?.min_sets ?? 10),
          max: Number(t?.max_sets ?? 20),
          priority: t?.priority ?? false,
          paused: t?.paused ?? false,
        }
      }),
    focus: (profile?.goal as Focus | null) ?? 'hypertrophy',
  }
}

/** Rates a saved plan's projected week. */
export function rateSavedPlan(rows: PlanRows | PlanWithVersions, ctx: RatingContext): Rating {
  const sessions = 'sessions' in rows ? rows.sessions : rows.versions
  return ratePlan({
    mode: 'plan',
    workouts: planWorkouts({ ...rows, sessions }),
    exercises: ctx.exercises,
    muscles: ctx.muscles,
    focus: ctx.focus,
  })
}

export interface ActualRating {
  rating: Rating
  weeks: number
  sessions: number
}

/** Rates the last 4 weeks of logged training (finished or in-progress workouts). */
export function useActualRating(ctx: RatingContext | undefined): ActualRating | null | undefined {
  const logged = useLiveQuery(async () => {
    const since = new Date(Date.now() - 29 * 86_400_000).toISOString()
    const sessions = (await db.sessions.where('started_at').aboveOrEqual(since).toArray()).filter(
      live,
    )
    const sets = (
      await db.sets
        .where('session_id')
        .anyOf(sessions.map((s) => s.id))
        .toArray()
    ).filter(live)
    return { sessions, sets, today: londonDate(new Date().toISOString()) }
  }, [])
  if (!ctx || !logged) return undefined
  const { workouts, weeks } = loggedWorkouts(
    logged.sessions.map((s) => ({ id: s.id, name: s.name, date: londonDate(s.started_at) })),
    logged.sets,
    logged.today,
  )
  if (!workouts.length) return null
  return {
    rating: ratePlan({
      mode: 'actual',
      workouts,
      weeks,
      exercises: ctx.exercises,
      muscles: ctx.muscles,
      focus: ctx.focus,
    }),
    weeks,
    sessions: workouts.length,
  }
}

/** Applies a one-tap fix to the plan: adds an exercise, or changes how many sets one has. */
export async function applyFix(
  planId: string,
  fix: Fix,
  note = 'Applied a rating fix',
): Promise<void> {
  if (fix.kind === 'add') {
    const exercise = await db.exercises.get(fix.exerciseId)
    if (!exercise) throw new Error('Exercise not found')
    const logType = asLogType(exercise.log_type)
    const peId = await addPlanExercise(fix.workoutId, exercise, logType)
    const pe = await db.plan_exercises.get(peId)
    if (pe) await setTargets(pe, withWorkingSets(defaultTargets(exercise, logType), fix.sets))
  } else if (fix.kind === 'move') {
    const day = (
      await db.plan_schedule.where('plan_session_id').equals(fix.workoutId).toArray()
    ).find((d) => live(d) && d.weekday === fix.fromDay)
    if (!day) throw new Error('That day is no longer in the plan')
    await saveOne('plan_schedule', { ...day, weekday: fix.toDay })
  } else if (fix.kind === 'regroup') {
    // Add moved exercises to the end of their new workout
    const next = new Map<string, number>()
    const changes: Change[] = []
    for (const m of fix.moves) {
      const pe = await db.plan_exercises.get(m.planExerciseId)
      if (!pe || pe.deleted_at) continue
      if (!next.has(m.toWorkoutId)) {
        const current = (
          await db.plan_exercises.where('plan_session_id').equals(m.toWorkoutId).toArray()
        ).filter(live)
        next.set(m.toWorkoutId, Math.max(-1, ...current.map((e) => e.order)) + 1)
      }
      const order = next.get(m.toWorkoutId)!
      next.set(m.toWorkoutId, order + 1)
      changes.push({
        table: 'plan_exercises',
        row: { ...pe, plan_session_id: m.toWorkoutId, order },
      })
    }
    await save(changes)
  } else {
    const pe = await db.plan_exercises.get(fix.planExerciseId)
    if (!pe) throw new Error('Exercise not found')
    const targets = (await db.plan_set_targets.where('plan_exercise_id').equals(pe.id).toArray())
      .filter(live)
      .toSorted((a, b) => a.order - b.order)
    await setTargets(pe, withWorkingSets(targets, fix.sets))
  }
  await snapshotIfChanged(planId, note)
}
