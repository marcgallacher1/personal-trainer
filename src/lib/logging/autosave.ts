/** A live workout you stopped logging in saves itself, ending at the last thing you logged. */

/** Minutes with nothing logged before a live workout saves itself */
export const AUTO_SAVE_MINUTES = 30

/**
 * When to end a live workout at, or null to leave it running.
 * `logged` are the completion times of its sets and cardio. A workout with nothing logged is
 * never auto-saved (there's nothing to save).
 */
export function autoSaveAt(
  session: { ended_at: string | null },
  logged: readonly string[],
  nowMs: number,
): string | null {
  if (session.ended_at || !logged.length) return null
  const last = logged.reduce((a, b) => (a > b ? a : b))
  return nowMs - Date.parse(last) > AUTO_SAVE_MINUTES * 60_000 ? last : null
}
