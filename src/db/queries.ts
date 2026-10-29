import { useLiveQuery } from 'dexie-react-hooks'
import { cardioTotals } from '../lib/cardio'
import type { LoggedSet } from '../lib/logging/types'
import type { Tables } from './database.types'
import { db } from './local'

export type Session = Tables<'sessions'>
export type SessionExercise = Tables<'session_exercises'>
export type SetRow = Tables<'sets'>
export type CardioEntry = Tables<'cardio_entries'>
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

export function useSessionCardio(sessionId: string | undefined): CardioEntry[] | undefined {
  return useLiveQuery(
    async () =>
      sessionId
        ? (await db.cardio_entries.where('session_id').equals(sessionId).toArray())
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
  cardio: { minutes: number; calories: number; activities: string[] }
}

function groupBySession<T extends { session_id: string; deleted_at: string | null }>(
  rows: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    if (r.deleted_at) continue
    const list = map.get(r.session_id) ?? []
    list.push(r)
    map.set(r.session_id, list)
  }
  return map
}

export function useSessionSummaries(): SessionSummary[] | undefined {
  return useLiveQuery(async () => {
    const [sessions, sets, cardio] = await Promise.all([
      db.sessions.toArray(),
      db.sets.toArray(),
      db.cardio_entries.toArray(),
    ])
    const setsBySession = groupBySession(sets)
    const cardioBySession = groupBySession(cardio)
    return sessions
      .filter(live)
      .toSorted((a, b) => b.started_at.localeCompare(a.started_at))
      .map((session) => {
        const ss = setsBySession.get(session.id) ?? []
        const cc = cardioBySession.get(session.id) ?? []
        const totals = cardioTotals(cc)
        return {
          session,
          setCount: ss.filter((s) => s.set_type !== 'warmup').length,
          volume: ss
            .filter((s) => s.set_type !== 'warmup')
            .reduce((v, s) => v + s.weight_kg * s.reps, 0),
          exerciseIds: [...new Set(ss.map((s) => s.exercise_id))],
          cardio: { ...totals, activities: [...new Set(cc.map((c) => c.activity))] },
        }
      })
  }, [])
}

export function useOutboxCount(): number | undefined {
  return useLiveQuery(() => db.outbox.count(), [])
}
