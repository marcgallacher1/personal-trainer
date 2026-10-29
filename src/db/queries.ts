import { useLiveQuery } from 'dexie-react-hooks'
import type { LoggedSet } from '../lib/logging/types'
import type { Tables } from './database.types'
import { db } from './local'

export type Session = Tables<'sessions'>
export type SessionExercise = Tables<'session_exercises'>
export type SetRow = Tables<'sets'>
export type Exercise = Tables<'exercises'>
export type Muscle = Tables<'muscles'>
export type ExerciseMuscle = Tables<'exercise_muscles'>

const live = <T extends { deleted_at: string | null }>(r: T) => r.deleted_at === null

export const asLogged = (s: SetRow): LoggedSet => s as LoggedSet

export function useActiveSession(): Session | null | undefined {
  return useLiveQuery(async () => {
    const open = await db.sessions.filter((s) => s.ended_at === null && live(s)).toArray()
    return open.toSorted((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null
  }, [])
}

export function useSession(id: string | undefined): Session | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.sessions.get(id)) ?? null) : null), [id])
}

export function useSessionExercises(sessionId: string | undefined): SessionExercise[] | undefined {
  return useLiveQuery(
    async () =>
      sessionId
        ? (await db.session_exercises.where('session_id').equals(sessionId).toArray())
            .filter(live)
            .toSorted((a, b) => a.order - b.order)
        : [],
    [sessionId],
  )
}

export function useSessionSets(sessionId: string | undefined): SetRow[] | undefined {
  return useLiveQuery(
    async () =>
      sessionId
        ? (await db.sets.where('session_id').equals(sessionId).toArray())
            .filter(live)
            .toSorted((a, b) => a.order - b.order)
        : [],
    [sessionId],
  )
}

/** Every set ever logged for an exercise (including deleted; pure functions filter). */
export function useExerciseHistory(exerciseId: string): SetRow[] | undefined {
  return useLiveQuery(() => db.sets.where('exercise_id').equals(exerciseId).toArray(), [exerciseId])
}

export function useExercises(): Exercise[] | undefined {
  return useLiveQuery(
    async () =>
      (await db.exercises.toArray()).filter(live).toSorted((a, b) => a.name.localeCompare(b.name)),
    [],
  )
}

export function useExercise(id: string | undefined): Exercise | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.exercises.get(id)) ?? null) : null), [id])
}

export function useMuscles(): Muscle[] | undefined {
  return useLiveQuery(
    async () => (await db.muscles.toArray()).toSorted((a, b) => a.sort_order - b.sort_order),
    [],
  )
}

/** exercise_id → its live muscle mappings */
export function useExerciseMuscleMap(): Map<string, ExerciseMuscle[]> | undefined {
  return useLiveQuery(async () => {
    const map = new Map<string, ExerciseMuscle[]>()
    for (const m of await db.exercise_muscles.toArray()) {
      if (m.deleted_at) continue
      const list = map.get(m.exercise_id) ?? []
      list.push(m)
      map.set(m.exercise_id, list)
    }
    return map
  }, [])
}

/** exercise_id → when it was last logged (ISO), for "recent first" sorting. */
export function useLastUsed(): Map<string, string> | undefined {
  return useLiveQuery(async () => {
    const map = new Map<string, string>()
    for (const s of await db.sets.toArray()) {
      if (s.deleted_at) continue
      const prev = map.get(s.exercise_id)
      if (!prev || s.completed_at > prev) map.set(s.exercise_id, s.completed_at)
    }
    return map
  }, [])
}

export interface SessionSummary {
  session: Session
  setCount: number
  volume: number
  exerciseIds: string[]
}

export function useSessionSummaries(): SessionSummary[] | undefined {
  return useLiveQuery(async () => {
    const [sessions, sets] = await Promise.all([db.sessions.toArray(), db.sets.toArray()])
    const bySession = new Map<string, SetRow[]>()
    for (const s of sets) {
      if (s.deleted_at) continue
      const list = bySession.get(s.session_id) ?? []
      list.push(s)
      bySession.set(s.session_id, list)
    }
    return sessions
      .filter(live)
      .toSorted((a, b) => b.started_at.localeCompare(a.started_at))
      .map((session) => {
        const ss = bySession.get(session.id) ?? []
        return {
          session,
          setCount: ss.filter((s) => s.set_type !== 'warmup').length,
          volume: ss
            .filter((s) => s.set_type !== 'warmup')
            .reduce((v, s) => v + s.weight_kg * s.reps, 0),
          exerciseIds: [...new Set(ss.map((s) => s.exercise_id))],
        }
      })
  }, [])
}

export function useOutboxCount(): number | undefined {
  return useLiveQuery(() => db.outbox.count(), [])
}
