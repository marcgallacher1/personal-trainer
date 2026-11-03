import { db } from '../../db/local'
import type { Session, SessionExercise, SetRow } from '../../db/queries'
import { requireUserId } from '../../db/user'
import { newId, nowIso, save, type Change } from '../../db/write'
import type { ImportedWorkout } from '../../lib/data/csv'
import { londonToIso } from '../../lib/time/london'

const live = <T extends { deleted_at: string | null }>(rows: T[]) =>
  rows.filter((r) => !r.deleted_at)

/** Saves imported workouts as finished workouts. Returns how many sets were added. */
export async function importWorkouts(workouts: readonly ImportedWorkout[]): Promise<number> {
  const userId = requireUserId()
  const now = nowIso()
  const meta = { user_id: userId, created_at: now, updated_at: now, deleted_at: null }
  const changes: Change[] = []
  let count = 0
  for (const w of workouts) {
    const started = londonToIso(w.date, w.time)
    const session: Session = {
      ...meta,
      id: newId(),
      plan_id: null,
      plan_session_id: null,
      name: w.name,
      started_at: started,
      ended_at: new Date(
        Date.parse(started) + Math.max(20, w.sets.length * 2.5) * 60_000,
      ).toISOString(),
      notes: 'Imported from CSV',
    }
    changes.push({ table: 'sessions', row: session })
    const items = new Map<string, SessionExercise>()
    const perItem = new Map<string, number>()
    w.sets.forEach((s, i) => {
      let se = items.get(s.exerciseId)
      if (!se) {
        se = {
          ...meta,
          id: newId(),
          session_id: session.id,
          exercise_id: s.exerciseId,
          plan_exercise_id: null,
          order: items.size,
          group_id: null,
          group_type: null,
          rest_seconds: null,
          notes: null,
        }
        items.set(s.exerciseId, se)
        changes.push({ table: 'session_exercises', row: se })
      }
      const order = perItem.get(se.id) ?? 0
      perItem.set(se.id, order + 1)
      const set: SetRow = {
        ...meta,
        id: newId(),
        session_id: session.id,
        session_exercise_id: se.id,
        exercise_id: s.exerciseId,
        plan_set_target_id: null,
        order,
        weight_kg: s.weightKg,
        reps: s.reps,
        duration_seconds: s.seconds,
        right_weight_kg: null,
        right_reps: null,
        rpe: null,
        rir: s.rir,
        set_type: s.setType,
        is_pr: false,
        completed_at: new Date(Date.parse(started) + (i + 1) * 150_000).toISOString(),
      }
      changes.push({ table: 'sets', row: set })
      count++
    })
  }
  for (let i = 0; i < changes.length; i += 400) await save(changes.slice(i, i + 400))
  return count
}

/** Everything you've logged, as one JSON document (for backups). */
export async function exportEverything(): Promise<string> {
  const [sessions, sessionExercises, sets, cardio, exercises, plans] = await Promise.all([
    db.sessions.toArray(),
    db.session_exercises.toArray(),
    db.sets.toArray(),
    db.cardio_entries.toArray(),
    db.exercises.toArray(),
    db.plans.toArray(),
  ])
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      app: 'Trainer',
      sessions: live(sessions),
      session_exercises: live(sessionExercises),
      sets: live(sets),
      cardio_entries: live(cardio),
      custom_exercises: live(exercises).filter((e) => e.is_custom),
      plans: live(plans),
    },
    null,
    2,
  )
}

/** Saves a file via the share sheet on iPhone, or a download elsewhere. */
export async function saveFile(name: string, type: string, text: string): Promise<void> {
  const file = new File([text], name, { type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
