import type { CardioEntry, Exercise, Session, SessionExercise, SetRow } from '../../db/queries'
import { db } from '../../db/local'
import { requireUserId } from '../../db/user'
import { deletion, newId, nowIso, restoration, save, saveOne, type Change } from '../../db/write'
import { bestSide } from '../../lib/logging/load'
import { detectPRs, type PR } from '../../lib/logging/pr'
import type { DraftSet, LogType } from '../../lib/logging/types'

const live = <T extends { deleted_at: string | null }>(r: T) => r.deleted_at === null

/** For a workout logged afterwards: when it started and finished. */
export interface PastTimes {
  startedAt: string
  endedAt: string
}

export async function startSession(past?: PastTimes): Promise<string> {
  const now = nowIso()
  const session: Session = {
    id: newId(),
    user_id: requireUserId(),
    plan_id: null,
    plan_session_id: null,
    name: null,
    started_at: past?.startedAt ?? now,
    ended_at: past?.endedAt ?? null,
    notes: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  await saveOne('sessions', session)
  return session.id
}

export async function updateSession(session: Session, patch: Partial<Session>): Promise<void> {
  await saveOne('sessions', { ...session, ...patch })
}

export async function finishSession(session: Session): Promise<void> {
  await updateSession(session, { ended_at: nowIso() })
}

export async function deleteSession(session: Session): Promise<Change[]> {
  const [exercises, sets, cardio] = await Promise.all([
    db.session_exercises.where('session_id').equals(session.id).toArray(),
    db.sets.where('session_id').equals(session.id).toArray(),
    db.cardio_entries.where('session_id').equals(session.id).toArray(),
  ])
  const changes = [
    // Children first so a partial upload never leaves live children under a deleted parent.
    ...sets.filter(live).map((s) => deletion('sets', s)),
    ...cardio.filter(live).map((c) => deletion('cardio_entries', c)),
    ...exercises.filter(live).map((e) => deletion('session_exercises', e)),
    deletion('sessions', session),
  ]
  await save(changes)
  return changes
}

/** Undo for any soft-delete batch returned above. */
export async function undoDeletion(changes: Change[]): Promise<void> {
  await save(changes.toReversed().map((c) => restoration(c.table, c.row)))
}

export async function addExercise(sessionId: string, exercise: Exercise): Promise<string> {
  const existing = (
    await db.session_exercises.where('session_id').equals(sessionId).toArray()
  ).filter(live)
  const now = nowIso()
  const row: SessionExercise = {
    id: newId(),
    user_id: requireUserId(),
    session_id: sessionId,
    exercise_id: exercise.id,
    plan_exercise_id: null,
    order: Math.max(-1, ...existing.map((e) => e.order)) + 1,
    group_id: null,
    group_type: null,
    rest_seconds: null,
    notes: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  await saveOne('session_exercises', row)
  return row.id
}

export async function updateSessionExercise(
  se: SessionExercise,
  patch: Partial<SessionExercise>,
): Promise<void> {
  await saveOne('session_exercises', { ...se, ...patch })
}

export async function removeSessionExercise(se: SessionExercise): Promise<Change[]> {
  const sets = (await db.sets.where('session_id').equals(se.session_id).toArray()).filter(
    (s) => live(s) && s.session_exercise_id === se.id,
  )
  const changes = [...sets.map((s) => deletion('sets', s)), deletion('session_exercises', se)]
  await save(changes)
  return changes
}

export async function moveSessionExercise(
  list: SessionExercise[],
  index: number,
  dir: -1 | 1,
): Promise<void> {
  const a = list[index]
  const b = list[index + dir]
  if (!a || !b) return
  await save([
    { table: 'session_exercises', row: { ...a, order: b.order } },
    { table: 'session_exercises', row: { ...b, order: a.order } },
  ])
}

/** Single-arm moves: PBs go by the stronger side. */
const strongest = <T extends Pick<DraftSet, 'weight_kg' | 'reps'>>(s: T): T => {
  const b = bestSide(s)
  return { ...s, weight_kg: b.weightKg, reps: b.reps }
}

/** Logs a set; returns its id and any PRs it sets (vs. every earlier set of that exercise). */
export async function logSet(
  se: SessionExercise,
  draft: DraftSet,
  rir: number | null,
  logType: LogType = 'weight_reps',
  planSetTargetId: string | null = null,
): Promise<{ id: string; prs: PR[] }> {
  const [history, today, session] = await Promise.all([
    db.sets.where('exercise_id').equals(se.exercise_id).toArray(),
    db.sets.where('session_id').equals(se.session_id).toArray(),
    db.sessions.get(se.session_id),
  ])
  const prs = detectPRs(
    strongest(draft),
    history.filter(live).map(strongest) as Parameters<typeof detectPRs>[1],
    logType,
  )
  const mine = today.filter((s) => live(s) && s.session_exercise_id === se.id)
  const now = nowIso()
  // A workout logged afterwards: space its sets through the workout, not "now"
  const completedAt =
    session?.ended_at && session.ended_at < now
      ? new Date(
          Math.min(
            Date.parse(session.ended_at),
            Date.parse(session.started_at) + (today.filter(live).length + 1) * 150_000,
          ),
        ).toISOString()
      : now
  const row: SetRow = {
    id: newId(),
    user_id: requireUserId(),
    session_id: se.session_id,
    session_exercise_id: se.id,
    exercise_id: se.exercise_id,
    plan_set_target_id: planSetTargetId,
    order: Math.max(-1, ...mine.map((s) => s.order)) + 1,
    weight_kg: draft.weight_kg,
    reps: draft.reps,
    right_weight_kg: draft.right_weight_kg ?? null,
    right_reps: draft.right_reps ?? null,
    duration_seconds: draft.duration_seconds,
    rpe: null,
    rir,
    set_type: draft.set_type,
    is_pr: prs.length > 0,
    completed_at: completedAt,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  const changes: Change[] = [{ table: 'sets', row }]
  // First thing logged in a live workout: the clock starts here, not when you opened it
  if (session && !session.ended_at && !today.some(live) && !(await hasCardio(session.id)))
    changes.push({ table: 'sessions', row: { ...session, started_at: now } })
  await save(changes)
  return { id: row.id, prs }
}

export async function updateSet(set: SetRow, patch: Partial<SetRow>): Promise<void> {
  await saveOne('sets', { ...set, ...patch })
}

export async function deleteSet(set: SetRow): Promise<Change[]> {
  const changes = [deletion('sets', set)]
  await save(changes)
  return changes
}

export interface CardioInput {
  activity: string
  duration_seconds: number
  calories: number | null
  distance_km: number | null
  avg_hr: number | null
  notes: string | null
  /** Speed, incline, intervals, pool… (see CardioDetails) */
  details_json?: CardioEntry['details_json']
}

async function hasCardio(sessionId: string): Promise<boolean> {
  return (await db.cardio_entries.where('session_id').equals(sessionId).toArray()).some(live)
}

/** Creates a cardio entry, or updates `existing`. */
export async function saveCardio(
  sessionId: string,
  input: CardioInput,
  existing?: CardioEntry,
): Promise<void> {
  if (existing) {
    await saveOne('cardio_entries', { ...existing, ...input })
    return
  }
  const others = (await db.cardio_entries.where('session_id').equals(sessionId).toArray()).filter(
    live,
  )
  const now = nowIso()
  const row: CardioEntry = {
    id: newId(),
    user_id: requireUserId(),
    session_id: sessionId,
    details_json: {},
    ...input,
    order: Math.max(-1, ...others.map((c) => c.order)) + 1,
    completed_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  const changes: Change[] = [{ table: 'cardio_entries', row }]
  // First thing logged in a live workout: it began when this cardio did
  const session = await db.sessions.get(sessionId)
  const sets = (await db.sets.where('session_id').equals(sessionId).toArray()).filter(live)
  if (session && !session.ended_at && !others.length && !sets.length) {
    const began = new Date(Date.parse(now) - input.duration_seconds * 1000).toISOString()
    changes.push({ table: 'sessions', row: { ...session, started_at: began } })
  }
  await save(changes)
}

export async function deleteCardio(entry: CardioEntry): Promise<Change[]> {
  const changes = [deletion('cardio_entries', entry)]
  await save(changes)
  return changes
}
