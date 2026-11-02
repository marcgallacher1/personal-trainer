/** Sets per muscle (secondary muscles count half), tonnage and sets per day. */
import { isWorking, weekOf, type ExerciseInfo, type TrainingSession } from './training'

/** Muscle groups for stacked charts, in display order. */
export const MUSCLE_GROUPS = [
  { id: 'chest', name: 'Chest', muscles: ['chest'] },
  { id: 'shoulders', name: 'Shoulders', muscles: ['front_delts', 'side_delts', 'rear_delts'] },
  { id: 'back', name: 'Back', muscles: ['lats', 'upper_back', 'lower_back'] },
  { id: 'arms', name: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
  { id: 'core', name: 'Core', muscles: ['abs', 'obliques'] },
  { id: 'legs', name: 'Legs', muscles: ['glutes', 'quads', 'hamstrings', 'adductors', 'calves'] },
] as const
export type MuscleGroupId = (typeof MUSCLE_GROUPS)[number]['id']

const round1 = (n: number) => Math.round(n * 2) / 2

/** Weighted working sets per muscle across some workouts. */
export function muscleSets(
  sessions: readonly TrainingSession[],
  info: ReadonlyMap<string, ExerciseInfo>,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const s of sessions) {
    for (const set of s.sets) {
      if (!isWorking(set)) continue
      for (const m of info.get(set.exerciseId)?.muscles ?? []) {
        out.set(m.muscleId, (out.get(m.muscleId) ?? 0) + m.weight)
      }
    }
  }
  for (const [k, v] of out) out.set(k, round1(v))
  return out
}

export interface WeekVolume {
  week: string
  /** Weighted sets per muscle group */
  groups: Record<MuscleGroupId, number>
  sets: number
  /** Weight × reps over working sets, kg */
  tonnage: number
}

/** Weekly sets per muscle group and tonnage, for every week in `weeks`. */
export function weeklyVolume(
  sessions: readonly TrainingSession[],
  info: ReadonlyMap<string, ExerciseInfo>,
  weeks: readonly string[],
): WeekVolume[] {
  const groupOf = new Map<string, MuscleGroupId>(
    MUSCLE_GROUPS.flatMap((g) => g.muscles.map((m) => [m, g.id] as const)),
  )
  const byWeek = new Map<string, TrainingSession[]>()
  for (const s of sessions) {
    const w = weekOf(s.date)
    byWeek.set(w, [...(byWeek.get(w) ?? []), s])
  }
  return weeks.map((week) => {
    const list = byWeek.get(week) ?? []
    const groups = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g.id, 0])) as Record<
      MuscleGroupId,
      number
    >
    for (const [muscle, sets] of muscleSets(list, info)) {
      const g = groupOf.get(muscle)
      if (g) groups[g] = round1(groups[g] + sets)
    }
    let sets = 0
    let tonnage = 0
    for (const s of list) {
      for (const set of s.sets) {
        if (!isWorking(set)) continue
        sets++
        tonnage += Math.max(0, set.weightKg) * Math.max(0, set.reps)
      }
    }
    return { week, groups, sets, tonnage: Math.round(tonnage) }
  })
}

/** Working sets per day (for the calendar heatmap). */
export function setsPerDay(sessions: readonly TrainingSession[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const s of sessions) {
    out.set(s.date, (out.get(s.date) ?? 0) + s.sets.filter(isWorking).length)
  }
  return out
}

/** Calendar shade 0–4 for a day's working sets: rest, light, moderate, solid, big. */
export function intensityLevel(sets: number): 0 | 1 | 2 | 3 | 4 {
  if (sets <= 0) return 0
  if (sets < 10) return 1
  if (sets < 18) return 2
  if (sets < 26) return 3
  return 4
}

export interface SessionStat {
  sessionId: string
  date: string
  name: string | null
  /** null while unfinished or if the end time looks wrong */
  minutes: number | null
  /** Average reps in reserve over working sets that recorded it */
  avgRir: number | null
  sets: number
}

/** Per-workout duration and effort (for trend charts). */
export function sessionStats(sessions: readonly TrainingSession[]): SessionStat[] {
  return sessions
    .toSorted((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((s) => {
      const working = s.sets.filter(isWorking)
      const rirs = working.map((x) => x.rir).filter((x): x is number => x !== null)
      const mins = s.endedAt ? (Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60_000 : null
      return {
        sessionId: s.id,
        date: s.date,
        name: s.name,
        minutes: mins !== null && mins > 0 && mins < 300 ? Math.round(mins) : null,
        avgRir: rirs.length
          ? Math.round((rirs.reduce((a, b) => a + b, 0) / rirs.length) * 10) / 10
          : null,
        sets: working.length,
      }
    })
}
