import { db } from '../../db/local'
import type { Session, SessionExercise, SetRow } from '../../db/queries'
import { requireUserId } from '../../db/user'
import { deletion, newId, nowIso, save, type Change } from '../../db/write'
import type { ExerciseInfo } from '../../lib/analysis/training'
import { generateSampleHistory, type SamplePlanWorkout } from '../../lib/fixtures/sample'
import { asLogType } from '../../lib/logging/logTypes'
import { TEMPLATES } from '../../lib/plans/templates'
import { isoWeek } from '../../lib/time/london'
import { londonDate } from '../log/format'
import { loadPlanRows } from '../plans/data'

/** Marks sample workouts so they (and only they) can be removed again. */
export const SAMPLE_NOTE = 'Sample workout (generated for testing)'

const live = (r: { deleted_at: string | null }) => r.deleted_at === null

async function exerciseInfo(): Promise<Map<string, ExerciseInfo>> {
  const [exercises, muscles] = await Promise.all([
    db.exercises.toArray(),
    db.exercise_muscles.toArray(),
  ])
  return new Map(
    exercises.filter(live).map((e) => [
      e.id,
      {
        id: e.id,
        name: e.name,
        pattern: e.pattern,
        isCompound: e.is_compound,
        logType: asLogType(e.log_type),
        restSeconds: e.default_rest_seconds,
        muscles: muscles
          .filter((m) => m.exercise_id === e.id && !m.deleted_at)
          .map((m) => ({ muscleId: m.muscle_id, weight: Number(m.weight) })),
      },
    ]),
  )
}

/** Adds ~12 weeks of fake workouts that follow the active plan. Returns how many. */
export async function loadSampleWorkouts(): Promise<number> {
  const info = await exerciseInfo()
  const active = (await db.plans.toArray()).find((p) => live(p) && p.is_active)
  const rows = active ? await loadPlanRows(active.id) : null

  let plan: SamplePlanWorkout[]
  if (rows && rows.sessions.length) {
    plan = rows.sessions.map((s) => ({
      id: s.id,
      name: s.name,
      days: rows.schedule
        .filter((d) => d.plan_session_id === s.id && d.weekday !== null)
        .map((d) => d.weekday!),
      exercises: rows.exercises
        .filter((e) => e.plan_session_id === s.id)
        .map((e) => {
          const t = rows.targets.filter(
            (x) => x.plan_exercise_id === e.id && x.set_type !== 'warmup',
          )
          return {
            exerciseId: e.exercise_id,
            sets: Math.max(1, t.length),
            repsMin: t[0]?.reps_min ?? t[0]?.seconds_min ?? 8,
            repsMax: t[0]?.reps_max ?? t[0]?.seconds_max ?? 12,
          }
        }),
    }))
  } else {
    const byName = new Map([...info.values()].map((e) => [e.name, e.id]))
    const pick = (type: string, version: string, days: number[]): SamplePlanWorkout => {
      const s = TEMPLATES.find((t) => t.id === type)!.sessions.find((v) => v.name === version)!
      return {
        id: `${type}-${version}`,
        name: `${TEMPLATES.find((t) => t.id === type)!.name} ${version}`,
        days,
        exercises: s.exercises.flatMap((e) =>
          byName.has(e.name)
            ? [{ exerciseId: byName.get(e.name)!, sets: e.sets, repsMin: e.min, repsMax: e.max }]
            : [],
        ),
      }
    }
    plan = [
      pick('push', 'A', [1]),
      pick('pull', 'A', [2]),
      pick('push', 'B', [4]),
      pick('pull', 'B', [5]),
    ]
  }

  const history = generateSampleHistory({
    plan,
    info,
    today: londonDate(new Date().toISOString()),
    seed: Date.now() % 100_000,
  })
  const userId = requireUserId()
  const now = nowIso()
  const meta = { user_id: userId, created_at: now, updated_at: now, deleted_at: null }
  const changes: Change[] = []
  for (const h of history) {
    const session: Session = {
      ...meta,
      id: newId(),
      plan_id: rows ? active!.id : null,
      plan_session_id: rows ? h.planSessionId : null,
      name: h.name,
      started_at: h.startedAt,
      ended_at: h.endedAt,
      notes: SAMPLE_NOTE,
    }
    changes.push({ table: 'sessions', row: session })
    let minute = 0
    h.exercises.forEach((e, order) => {
      const se: SessionExercise = {
        ...meta,
        id: newId(),
        session_id: session.id,
        exercise_id: e.exerciseId,
        plan_exercise_id: null,
        order,
        group_id: null,
        group_type: null,
        rest_seconds: null,
        notes: null,
      }
      changes.push({ table: 'session_exercises', row: se })
      e.sets.forEach((s, i) => {
        minute += 2.5
        const set: SetRow = {
          ...meta,
          id: newId(),
          session_id: session.id,
          session_exercise_id: se.id,
          exercise_id: e.exerciseId,
          plan_set_target_id: null,
          order: i,
          weight_kg: s.weightKg,
          reps: s.reps,
          duration_seconds: s.seconds,
          rpe: null,
          rir: s.rir,
          set_type: 'working',
          is_pr: false,
          completed_at: new Date(Date.parse(h.startedAt) + minute * 60_000).toISOString(),
        }
        changes.push({ table: 'sets', row: set })
      })
    })
  }
  // Batches keep each local transaction small
  for (let i = 0; i < changes.length; i += 400) await save(changes.slice(i, i + 400))
  return history.length
}

/** Removes every sample workout, plus reports saved for those weeks. Real workouts are untouched. */
export async function removeSampleWorkouts(): Promise<number> {
  const sessions = (await db.sessions.toArray()).filter((s) => live(s) && s.notes === SAMPLE_NOTE)
  const ids = sessions.map((s) => s.id)
  const [items, sets] = await Promise.all([
    db.session_exercises.where('session_id').anyOf(ids).toArray(),
    db.sets.where('session_id').anyOf(ids).toArray(),
  ])
  const weeks = new Set(sessions.map((s) => isoWeek(londonDate(s.started_at))))
  const reports = (await db.weekly_reports.toArray()).filter(
    (r) => live(r) && weeks.has(r.iso_week),
  )
  const changes: Change[] = [
    ...reports.map((r) => deletion('weekly_reports', r)),
    ...sets.filter(live).map((r) => deletion('sets', r)),
    ...items.filter(live).map((r) => deletion('session_exercises', r)),
    ...sessions.map((r) => deletion('sessions', r)),
  ]
  for (let i = 0; i < changes.length; i += 400) await save(changes.slice(i, i + 400))
  return sessions.length
}

export async function countSampleWorkouts(): Promise<number> {
  return (await db.sessions.toArray()).filter((s) => live(s) && s.notes === SAMPLE_NOTE).length
}
