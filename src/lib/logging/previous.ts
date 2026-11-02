import type { DraftSet, LoggedSet } from './types'

export interface PreviousPerformance {
  sessionId: string
  /** completed_at of the last set in that session (ISO) */
  date: string
  sets: LoggedSet[]
}

const live = (s: LoggedSet) => s.deleted_at === null

/** The most recent other session's sets for one exercise, in logged order. */
export function previousPerformance(
  setsForExercise: readonly LoggedSet[],
  currentSessionId: string,
): PreviousPerformance | null {
  const others = setsForExercise.filter((s) => live(s) && s.session_id !== currentSessionId)
  if (others.length === 0) return null

  const latest = others.reduce((a, b) => (b.completed_at > a.completed_at ? b : a))
  const sets = others
    .filter((s) => s.session_id === latest.session_id)
    .toSorted((a, b) => a.order - b.order || a.completed_at.localeCompare(b.completed_at))
  return { sessionId: latest.session_id, date: latest.completed_at, sets }
}

const toDraft = (
  s: Pick<LoggedSet, 'weight_kg' | 'reps' | 'duration_seconds' | 'set_type'>,
): DraftSet => ({
  weight_kg: s.weight_kg,
  reps: s.reps,
  duration_seconds: s.duration_seconds,
  set_type: s.set_type,
})

/** Last session's sets not yet repeated today. */
export function remainingDrafts(
  previous: PreviousPerformance | null,
  loggedToday: readonly LoggedSet[],
): DraftSet[] {
  if (!previous) return []
  const done = loggedToday.filter(live).length
  return previous.sets.slice(done).map(toDraft)
}

/** Next set: today's last set, else last time's first, else blank. */
export function nextDraft(
  previous: PreviousPerformance | null,
  loggedToday: readonly LoggedSet[],
): DraftSet {
  const today = loggedToday.filter(live).toSorted((a, b) => a.order - b.order)
  const last = today.at(-1)
  if (last) return toDraft(last)
  const first = previous?.sets.find((s) => s.set_type !== 'warmup') ?? previous?.sets[0]
  if (first) return toDraft(first)
  return { weight_kg: 0, reps: 0, duration_seconds: null, set_type: 'working' }
}
