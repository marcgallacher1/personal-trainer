/** When a workout counts as empty, and when an empty one is old enough to tidy away. */

/** Empty workouts this old are removed when the app opens (left via the tab bar, say). */
export const ABANDONED_HOURS = 12

export interface WorkoutContent {
  notes: string | null
  /** Live (not deleted) sets and cardio entries */
  sets: number
  cardio: number
}

/** Nothing logged and nothing written: safe to throw away. */
export function isEmptyWorkout(w: WorkoutContent): boolean {
  return w.sets === 0 && w.cardio === 0 && !w.notes?.trim()
}

/**
 * Should going Back throw this workout away?
 * - In progress: only if it's blank (no exercises either). One with exercises chosen is kept,
 *   so you can set a workout up, leave the screen and come back to it.
 * - Logged afterwards (already "finished"): if nothing was logged, as there's nothing to resume.
 */
export function discardOnBack(
  w: WorkoutContent & { exercises: number; finished: boolean },
): boolean {
  return isEmptyWorkout(w) && (w.finished || w.exercises === 0)
}

/** Empty, and created long enough ago that it's clearly not being used. */
export function isAbandoned(w: WorkoutContent & { created_at: string }, nowMs: number): boolean {
  return isEmptyWorkout(w) && nowMs - Date.parse(w.created_at) > ABANDONED_HOURS * 3_600_000
}
