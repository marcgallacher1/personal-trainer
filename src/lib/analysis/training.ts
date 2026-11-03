/** Shared types and date helpers. Dates are London days (YYYY-MM-DD); weeks start Monday. */
import type { RatingExercise } from '../rating/rate'

/** What analysis needs to know about an exercise (same shape the plan rating uses). */
export type ExerciseInfo = RatingExercise

export interface TrainingSet {
  exerciseId: string
  weightKg: number
  reps: number
  seconds: number | null
  setType: string
  rir: number | null
  /** Real weight × reps (both dumbbells, both sides). Defaults to weightKg × reps */
  tonnageKg?: number
}

/** Weight × reps actually moved by a set. */
export const tonnageOf = (s: TrainingSet): number =>
  s.tonnageKg ?? Math.max(0, s.weightKg) * Math.max(0, s.reps)

export interface TrainingSession {
  id: string
  /** London day it started */
  date: string
  startedAt: string
  endedAt: string | null
  name: string | null
  planId: string | null
  planSessionId: string | null
  sets: TrainingSet[]
}

export const isWorking = (s: { setType: string }) => s.setType !== 'warmup'

const DAY_MS = 86_400_000

export const dayNumber = (date: string): number =>
  Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS)
export const fromDayNumber = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10)
export const addDays = (date: string, n: number): string => fromDayNumber(dayNumber(date) + n)

/** 1 = Monday … 7 = Sunday */
export const weekdayOf = (date: string): number => ((dayNumber(date) + 3) % 7) + 1

/** The Monday of the week a day falls in. */
export const weekOf = (date: string): string => addDays(date, 1 - weekdayOf(date))

/** Week starts (Mondays) from the week of `from` to the week of `to`, inclusive. */
export function weeksBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let w = weekOf(from); w <= weekOf(to); w = addDays(w, 7)) out.push(w)
  return out
}

/** Working sets per exercise in a session, in first-done order. */
export function setsByExercise(session: TrainingSession): { exerciseId: string; sets: number }[] {
  const counts = new Map<string, number>()
  for (const s of session.sets) {
    if (isWorking(s)) counts.set(s.exerciseId, (counts.get(s.exerciseId) ?? 0) + 1)
  }
  return [...counts].map(([exerciseId, sets]) => ({ exerciseId, sets }))
}

/** Date ranges for chart filters, in days back from today (null = everything). */
export const RANGES = [
  { id: '4w', label: '4w', days: 28 },
  { id: '12w', label: '12w', days: 84 },
  { id: '6m', label: '6m', days: 182 },
  { id: '1y', label: '1y', days: 365 },
  { id: 'all', label: 'All', days: null },
] as const
export type RangeId = (typeof RANGES)[number]['id']

/** First day included by a range, given today and the earliest data. */
export function rangeStart(range: RangeId, today: string, earliest: string | null): string {
  const days = RANGES.find((r) => r.id === range)?.days ?? null
  if (days === null) return earliest ?? today
  return addDays(today, 1 - days)
}
