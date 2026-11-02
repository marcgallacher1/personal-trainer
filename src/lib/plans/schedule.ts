/** Scheduling logic for plans. Dates are London calendar days (YYYY-MM-DD). */

export interface SessionRef {
  id: string
  order: number
}

export interface WorkoutRef {
  plan_session_id: string | null
  started_at: string
  /** London calendar day the workout started on */
  day: string
  /** Has at least one logged working set or cardio entry */
  active: boolean
}

/** Rotation: the session after the last one done, or the first. */
export function nextInRotation<T extends SessionRef>(
  sessions: readonly T[],
  workouts: readonly WorkoutRef[],
): T | null {
  const ordered = sessions.toSorted((a, b) => a.order - b.order)
  if (ordered.length === 0) return null
  const ids = new Set(ordered.map((s) => s.id))
  const last = workouts
    .filter((w) => w.active && w.plan_session_id && ids.has(w.plan_session_id))
    .toSorted((a, b) => b.started_at.localeCompare(a.started_at))[0]
  if (!last) return ordered[0]!
  const idx = ordered.findIndex((s) => s.id === last.plan_session_id)
  return ordered[(idx + 1) % ordered.length]!
}

export interface WeekdayAssignment {
  plan_session_id: string | null
  weekday: number | null
}

/** Weekday mode: sessions assigned to an ISO weekday (1 = Monday). */
export function sessionsForWeekday<T extends SessionRef>(
  sessions: readonly T[],
  schedule: readonly WeekdayAssignment[],
  weekday: number,
): T[] {
  const ids = new Set(schedule.filter((s) => s.weekday === weekday).map((s) => s.plan_session_id))
  return sessions.filter((s) => ids.has(s.id)).toSorted((a, b) => a.order - b.order)
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a YYYY-MM-DD date. */
export function isoWeekday(day: string): number {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

/** Monday (YYYY-MM-DD) of the ISO week containing `day`. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - (isoWeekday(day) - 1))
  return d.toISOString().slice(0, 10)
}

/** Workouts with something logged this ISO week (Mon–Sun) vs the weekly target. */
export function weekProgress(
  workouts: readonly WorkoutRef[],
  today: string,
  target: number,
): { done: number; target: number; days: string[] } {
  const start = weekStart(today)
  const end = new Date(`${start}T12:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  const endDay = end.toISOString().slice(0, 10)
  const days = workouts
    .filter((w) => w.active && w.day >= start && w.day <= endDay)
    .map((w) => w.day)
  return { done: days.length, target, days: [...new Set(days)].toSorted() }
}
