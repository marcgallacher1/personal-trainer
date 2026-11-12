import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/local'
import type { PlannedWorkout } from '../../lib/analysis/adherence'
import { actualMuscles } from '../../lib/analysis/muscles'
import { bestSide, setTonnage } from '../../lib/logging/load'
import { asLoadMode } from '../../lib/logging/types'
import { planStart } from '../../lib/analysis/adherence'
import type { TrainingSession } from '../../lib/analysis/training'
import { planWorkouts } from '../../lib/rating/inputs'
import type { MuscleVolume } from '../../lib/rating/rate'
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

/** Every logged workout (with at least one set or cardio entry) plus what's needed to analyse it. */
export function useTrainingData(): TrainingData | undefined {
  const ctx = useRatingContext()
  const library = usePlanLibrary()
  const logged = useLiveQuery(async () => {
    const [sessions, sets, exercises, cardio, listedRows] = await Promise.all([
      db.sessions.toArray(),
      db.sets.toArray(),
      db.exercises.toArray(),
      db.cardio_entries.toArray(),
      db.session_exercises.toArray(),
    ])
    // Exercises on each workout's list, for "what was agreed" in the rating
    const listed = new Map<string, string[]>()
    for (const r of listedRows) {
      if (live(r)) listed.set(r.session_id, [...(listed.get(r.session_id) ?? []), r.exercise_id])
    }
    // Cardio-only workouts count too (e.g. a planned run day)
    const withCardio = new Set(cardio.filter(live).map((c) => c.session_id))
    const modeOf = new Map(exercises.map((e) => [e.id, asLoadMode(e.load_mode)]))
    const bySession = new Map<string, TrainingSession['sets']>()
    for (const s of sets) {
      if (!live(s)) continue
      const list = bySession.get(s.session_id) ?? []
      // Single-arm sets count as the stronger side
      const best = bestSide(s)
      list.push({
        exerciseId: s.exercise_id,
        weightKg: best.weightKg,
        reps: best.reps,
        tonnageKg: setTonnage(s, modeOf.get(s.exercise_id) ?? 'total'),
        seconds: s.duration_seconds,
        setType: s.set_type,
        rir: s.rir,
      })
      bySession.set(s.session_id, list)
    }
    return {
      today: londonDate(new Date().toISOString()),
      sessions: sessions
        .filter((s) => live(s) && (bySession.has(s.id) || withCardio.has(s.id)))
        .map((s): TrainingSession => ({
          id: s.id,
          date: londonDate(s.started_at),
          startedAt: s.started_at,
          endedAt: s.ended_at,
          name: s.name,
          planId: s.plan_id,
          planSessionId: s.plan_session_id,
          listed: listed.get(s.id),
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
        days: w.days,
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
  const planSince = planStart(firstOnPlan ?? null, created)

  return { sessions: logged.sessions, ctx, today: logged.today, active, planned, planSince }
}

/** Muscle-by-muscle sets for some workouts, as weekly figures against your targets. */
export function musclesFor(
  sessions: readonly TrainingSession[],
  ctx: RatingContext,
  weeks: number,
): MuscleVolume[] {
  return actualMuscles(sessions, ctx, weeks)
}
