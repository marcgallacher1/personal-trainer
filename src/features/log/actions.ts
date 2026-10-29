import type { Exercise, Session, SessionExercise, SetRow } from '../../db/queries'
import { db } from '../../db/local'
import { requireUserId } from '../../db/user'
import { deletion, newId, nowIso, restoration, save, saveOne, type Change } from '../../db/write'
import { detectPRs, type PR } from '../../lib/logging/pr'
import type { DraftSet } from '../../lib/logging/types'

const live = <T extends { deleted_at: string | null }>(r: T) => r.deleted_at === null

export async function startSession(): Promise<string> {
  const now = nowIso()
  const session: Session = {
    id: newId(),
    user_id: requireUserId(),
    plan_id: null,
    plan_session_id: null,
    name: null,
    started_at: now,
    ended_at: null,
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
  const [exercises, sets] = await Promise.all([
    db.session_exercises.where('session_id').equals(session.id).toArray(),
    db.sets.where('session_id').equals(session.id).toArray(),
  ])
  const changes = [
    // Children first so a partial upload never leaves live children under a deleted parent.
    ...sets.filter(live).map((s) => deletion('sets', s)),
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

export async function addExercise(sessionId: string, exercise: Exercise): Promise<void> {
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

/** Logs a set and returns any PRs it sets (vs. every earlier set of that exercise). */
export async function logSet(
  se: SessionExercise,
  draft: DraftSet,
  rir: number | null,
): Promise<PR[]> {
  const [history, today] = await Promise.all([
    db.sets.where('exercise_id').equals(se.exercise_id).toArray(),
    db.sets.where('session_id').equals(se.session_id).toArray(),
  ])
  const prs = detectPRs(draft, history.filter(live) as Parameters<typeof detectPRs>[1])
  const mine = today.filter((s) => live(s) && s.session_exercise_id === se.id)
  const now = nowIso()
  const row: SetRow = {
    id: newId(),
    user_id: requireUserId(),
    session_id: se.session_id,
    session_exercise_id: se.id,
    exercise_id: se.exercise_id,
    plan_set_target_id: null,
    order: Math.max(-1, ...mine.map((s) => s.order)) + 1,
    weight_kg: draft.weight_kg,
    reps: draft.reps,
    rpe: null,
    rir,
    set_type: draft.set_type,
    is_pr: prs.length > 0,
    completed_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  await saveOne('sets', row)
  return prs
}

export async function updateSet(set: SetRow, patch: Partial<SetRow>): Promise<void> {
  await saveOne('sets', { ...set, ...patch })
}

export async function deleteSet(set: SetRow): Promise<Change[]> {
  const changes = [deletion('sets', set)]
  await save(changes)
  return changes
}
