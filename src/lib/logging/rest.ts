/** Rest between sets, from when each set was logged. */

/** Rough time to actually do a set and open the app (you log right after finishing). */
export const SET_SECONDS = 45
/** Longer gaps are a break or a different exercise, not rest. */
const MAX_REST_SECONDS = 15 * 60

/** Seconds rested before a set, or null if it can't be told. */
export function restBefore(previousAt: string, at: string): number | null {
  const gap = (Date.parse(at) - Date.parse(previousAt)) / 1000
  if (!Number.isFinite(gap) || gap <= 0 || gap > MAX_REST_SECONDS) return null
  return Math.max(0, Math.round(gap - SET_SECONDS))
}

/** "1:05" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
