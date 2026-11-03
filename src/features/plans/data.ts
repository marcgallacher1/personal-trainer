import { useLiveQuery } from 'dexie-react-hooks'
import type { Tables } from '../../db/database.types'
import { db } from '../../db/local'
import type { Exercise, Session, SessionExercise } from '../../db/queries'
import { requireUserId } from '../../db/user'
import { deletion, newId, nowIso, save, saveOne, type Change } from '../../db/write'
import { isTimed, type LogType } from '../../lib/logging/types'
import {
  buildPlanFromDraft,
  customExercisesOf,
  emojiFor,
  presetFor,
  titleFor,
  type DraftItem,
  type WorkoutSource,
} from '../../lib/plans/draft'
import {
  instantiateWorkout,
  newPlanExerciseRow,
  newScheduleRow,
  newTargetRow,
  type Ctx,
  type PlanExerciseRow,
  type PlanRow,
  type PlanRows,
  type PlanScheduleRow,
  type PlanSessionRow,
  type PlanSetTargetRow,
} from '../../lib/plans/instantiate'
import {
  buildSnapshot,
  planRestore,
  snapshotFromJson,
  snapshotKey,
  snapshotToJson,
} from '../../lib/plans/snapshot'
import { quickSets, type TargetLike } from '../../lib/plans/targets'

export type PlanVersionRow = Tables<'plan_versions'>
export type Profile = Tables<'profiles'>
export type MuscleTarget = Tables<'muscle_targets'>

const live = <T extends { deleted_at: string | null }>(r: T) => r.deleted_at === null
const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order
const ctx = (): Ctx => ({ userId: requireUserId(), now: nowIso(), newId })

// --- Queries ---

export function usePlans(): PlanRow[] | undefined {
  return useLiveQuery(
    async () =>
      (await db.plans.toArray())
        .filter(live)
        .toSorted(
          (a, b) =>
            Number(a.archived) - Number(b.archived) || a.created_at.localeCompare(b.created_at),
        ),
    [],
  )
}

export interface PlanWithVersions {
  plan: PlanRow
  versions: PlanSessionRow[]
  schedule: PlanScheduleRow[]
  exercises: PlanExerciseRow[]
  targets: PlanSetTargetRow[]
}

/** Every non-archived plan with all its rows. */
export function usePlanLibrary(): PlanWithVersions[] | undefined {
  return useLiveQuery(async () => {
    const plans = (await db.plans.toArray())
      .filter((p) => live(p) && !p.archived)
      .toSorted((a, b) => a.created_at.localeCompare(b.created_at))
    const out: PlanWithVersions[] = []
    for (const plan of plans) {
      const rows = await loadPlanRows(plan.id)
      if (!rows) continue
      out.push({
        plan,
        versions: rows.sessions,
        schedule: rows.schedule,
        exercises: rows.exercises,
        targets: rows.targets,
      })
    }
    return out
  }, [])
}

/** Every live row of a plan, in display order. */
export async function loadPlanRows(
  planId: string,
  includeDeleted = false,
): Promise<PlanRows | null> {
  const plan = await db.plans.get(planId)
  if (!plan) return null
  const keep = <T extends { deleted_at: string | null }>(xs: T[]) =>
    includeDeleted ? xs : xs.filter(live)
  const sessions = keep(await db.plan_sessions.where('plan_id').equals(planId).toArray()).toSorted(
    byOrder,
  )
  const schedule = keep(await db.plan_schedule.where('plan_id').equals(planId).toArray())
  const sessionIds = sessions.map((s) => s.id)
  const exercises = keep(
    await db.plan_exercises.where('plan_session_id').anyOf(sessionIds).toArray(),
  ).toSorted(byOrder)
  const targets = keep(
    await db.plan_set_targets
      .where('plan_exercise_id')
      .anyOf(exercises.map((e) => e.id))
      .toArray(),
  ).toSorted(byOrder)
  return { plan, sessions, schedule, exercises, targets }
}

export function usePlanRows(planId: string | undefined): PlanRows | null | undefined {
  return useLiveQuery(async () => (planId ? loadPlanRows(planId) : null), [planId])
}

export function usePlanVersions(planId: string | undefined): PlanVersionRow[] | undefined {
  return useLiveQuery(
    async () =>
      planId
        ? (await db.plan_versions.where('plan_id').equals(planId).toArray())
            .filter(live)
            .toSorted((a, b) => b.version - a.version)
        : [],
    [planId],
  )
}

/** Plan targets for one planned exercise (used while logging). */
export function usePlanTargets(planExerciseId: string | null): PlanSetTargetRow[] | undefined {
  return useLiveQuery(
    async () =>
      planExerciseId
        ? (await db.plan_set_targets.where('plan_exercise_id').equals(planExerciseId).toArray())
            .filter(live)
            .toSorted(byOrder)
        : [],
    [planExerciseId],
  )
}

export function usePlanExercise(id: string | null): PlanExerciseRow | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.plan_exercises.get(id)) ?? null) : null), [id])
}

export function useProfile(): Profile | null | undefined {
  return useLiveQuery(async () => {
    const userId = (await db.meta.get('owner'))?.value as string | undefined
    return userId ? ((await db.profiles.get(userId)) ?? null) : null
  }, [])
}

export function useMuscleTargets(): MuscleTarget[] | undefined {
  return useLiveQuery(async () => (await db.muscle_targets.toArray()).filter(live), [])
}

// --- Plans ---

const insertAll = (rows: PlanRows): Change[] => [
  { table: 'plans', row: rows.plan },
  ...rows.sessions.map((row) => ({ table: 'plan_sessions' as const, row })),
  ...rows.schedule.map((row) => ({ table: 'plan_schedule' as const, row })),
  ...rows.exercises.map((row) => ({ table: 'plan_exercises' as const, row })),
  ...rows.targets.map((row) => ({ table: 'plan_set_targets' as const, row })),
]

async function exerciseIdsByName(): Promise<Map<string, string>> {
  const exercises = (await db.exercises.toArray()).filter(live)
  return new Map(exercises.map((e) => [e.name, e.id]))
}

/** Saves a plan built with the plan builder. Optionally makes it the active plan. */
export async function savePlanFromDraft(
  name: string,
  draft: readonly DraftItem[],
  makeActive: boolean,
): Promise<string> {
  const rows = buildPlanFromDraft(name, draft, await exerciseIdsByName(), ctx())
  await save(insertAll(rows))
  if (makeActive) await setPlanActive(rows.plan, true)
  await snapshotIfChanged(rows.plan.id, 'Created')
  return rows.plan.id
}

export async function updatePlan(plan: PlanRow, patch: Partial<PlanRow>): Promise<void> {
  await saveOne('plans', { ...plan, ...patch })
}

/** Turns a plan on or off. Only one can be on at a time. */
export async function setPlanActive(plan: PlanRow, active: boolean): Promise<void> {
  const fresh = (await db.plans.get(plan.id)) ?? plan
  if (!active) {
    await updatePlan(fresh, { is_active: false })
    return
  }
  const others = (await db.plans.toArray()).filter((p) => p.is_active && p.id !== plan.id)
  await save([
    // Deactivations first: the database allows one active plan per user
    ...others.map((p) => ({ table: 'plans' as const, row: { ...p, is_active: false } })),
    { table: 'plans', row: { ...fresh, is_active: true, archived: false } },
  ])
}

export async function archivePlan(plan: PlanRow, archived: boolean): Promise<void> {
  await updatePlan(plan, { archived, is_active: false })
}

/** Toggles a workout's day in a saved plan, adding the workout if it's new. */
export async function togglePlanDay(
  planId: string,
  source: WorkoutSource,
  weekday: number,
): Promise<'added' | 'removed'> {
  const rows = await loadPlanRows(planId)
  if (!rows) throw new Error('Plan not found')
  const title = titleFor(source)
  const existing = rows.sessions.find((s) => s.name.toLowerCase() === title.toLowerCase())
  const c = ctx()
  if (existing) {
    const day = rows.schedule.find(
      (s) => s.plan_session_id === existing.id && s.weekday === weekday,
    )
    if (day) {
      await save([deletion('plan_schedule', day)])
      return 'removed'
    }
    await saveOne('plan_schedule', newScheduleRow(c, planId, existing.id, weekday))
    return 'added'
  }
  const order = Math.max(-1, ...rows.sessions.map((s) => s.order)) + 1
  const w = instantiateWorkout(
    presetFor(source),
    planId,
    title,
    order,
    await exerciseIdsByName(),
    c,
    customExercisesOf(source),
    emojiFor(source),
  )
  await save([
    { table: 'plan_sessions', row: w.session },
    ...w.exercises.map((row) => ({ table: 'plan_exercises' as const, row })),
    ...w.targets.map((row) => ({ table: 'plan_set_targets' as const, row })),
    { table: 'plan_schedule', row: newScheduleRow(c, planId, w.session.id, weekday) },
  ])
  return 'added'
}

export async function deletePlan(plan: PlanRow): Promise<Change[]> {
  const rows = await loadPlanRows(plan.id)
  if (!rows) return []
  const changes = [
    ...rows.targets.map((r) => deletion('plan_set_targets', r)),
    ...rows.exercises.map((r) => deletion('plan_exercises', r)),
    ...rows.schedule.map((r) => deletion('plan_schedule', r)),
    ...rows.sessions.map((r) => deletion('plan_sessions', r)),
    deletion('plans', { ...plan, is_active: false }),
  ]
  await save(changes)
  return changes
}

export async function duplicatePlan(plan: PlanRow): Promise<string> {
  const rows = await loadPlanRows(plan.id)
  if (!rows) throw new Error('Plan not found')
  const c = ctx()
  const ids = new Map<string, string>()
  const remap = (id: string) => {
    if (!ids.has(id)) ids.set(id, c.newId())
    return ids.get(id)!
  }
  const stamp = { created_at: c.now, updated_at: c.now, deleted_at: null }
  const copy: PlanRows = {
    plan: {
      ...rows.plan,
      ...stamp,
      id: remap(rows.plan.id),
      name: `${plan.name} (copy)`,
      is_active: false,
      archived: false,
      current_version: 1,
    },
    sessions: rows.sessions.map((s) => ({
      ...s,
      ...stamp,
      id: remap(s.id),
      plan_id: remap(s.plan_id),
    })),
    schedule: rows.schedule.map((s) => ({
      ...s,
      ...stamp,
      id: remap(s.id),
      plan_id: remap(s.plan_id),
      plan_session_id: s.plan_session_id ? remap(s.plan_session_id) : null,
    })),
    exercises: rows.exercises.map((e) => ({
      ...e,
      ...stamp,
      id: remap(e.id),
      plan_session_id: remap(e.plan_session_id),
      group_id: e.group_id ? remap(e.group_id) : null,
    })),
    targets: rows.targets.map((t) => ({
      ...t,
      ...stamp,
      id: remap(t.id),
      plan_exercise_id: remap(t.plan_exercise_id),
    })),
  }
  await save(insertAll(copy))
  await snapshotIfChanged(copy.plan.id, `Copied from ${plan.name}`)
  return copy.plan.id
}

// --- Sessions & schedule ---

export async function updatePlanSession(
  s: PlanSessionRow,
  patch: Partial<PlanSessionRow>,
): Promise<void> {
  await saveOne('plan_sessions', { ...s, ...patch })
}

export async function deletePlanSession(s: PlanSessionRow): Promise<Change[]> {
  const exercises = (
    await db.plan_exercises.where('plan_session_id').equals(s.id).toArray()
  ).filter(live)
  const targets = (
    await db.plan_set_targets
      .where('plan_exercise_id')
      .anyOf(exercises.map((e) => e.id))
      .toArray()
  ).filter(live)
  const schedule = (await db.plan_schedule.where('plan_session_id').equals(s.id).toArray()).filter(
    live,
  )
  const changes = [
    ...targets.map((r) => deletion('plan_set_targets', r)),
    ...exercises.map((r) => deletion('plan_exercises', r)),
    ...schedule.map((r) => deletion('plan_schedule', r)),
    deletion('plan_sessions', s),
  ]
  await save(changes)
  return changes
}

export async function swapOrder<T extends { order: number }>(
  table: 'plan_sessions' | 'plan_exercises',
  list: T[],
  index: number,
  dir: -1 | 1,
): Promise<void> {
  const a = list[index]
  const b = list[index + dir]
  if (!a || !b) return
  await save([
    { table, row: { ...a, order: b.order } },
    { table, row: { ...b, order: a.order } },
  ])
}

/** Weekday mode: toggle a session on/off an ISO weekday. */
export async function toggleWeekday(
  planId: string,
  sessionId: string,
  weekday: number,
  schedule: PlanScheduleRow[],
): Promise<void> {
  const existing = schedule.find((s) => s.plan_session_id === sessionId && s.weekday === weekday)
  if (existing) {
    await save([deletion('plan_schedule', existing)])
    return
  }
  await saveOne('plan_schedule', newScheduleRow(ctx(), planId, sessionId, weekday))
}

// --- Planned exercises & targets ---

/** Starting targets: compounds 3 × 8–12, isolations 3 × 10–15, holds 3 × 30–60 s. */
export function defaultTargets(exercise: Exercise, logType: LogType): TargetLike[] {
  if (isTimed(logType)) return quickSets({ sets: 3, min: 30, max: 60, rir: null }, logType)
  return exercise.is_compound
    ? quickSets({ sets: 3, min: 8, max: 12, rir: 1 }, logType)
    : quickSets({ sets: 3, min: 10, max: 15, rir: 0 }, logType)
}

export async function addPlanExercise(
  sessionId: string,
  exercise: Exercise,
  logType: LogType,
): Promise<string> {
  const existing = (
    await db.plan_exercises.where('plan_session_id').equals(sessionId).toArray()
  ).filter(live)
  const c = ctx()
  const pe = newPlanExerciseRow(
    c,
    sessionId,
    exercise.id,
    Math.max(-1, ...existing.map((e) => e.order)) + 1,
  )
  const targets = defaultTargets(exercise, logType).map((t, i) => newTargetRow(c, pe.id, i, t))
  await save([
    { table: 'plan_exercises', row: pe },
    ...targets.map((row) => ({ table: 'plan_set_targets' as const, row })),
  ])
  return pe.id
}

export async function updatePlanExercise(
  pe: PlanExerciseRow,
  patch: Partial<PlanExerciseRow>,
): Promise<void> {
  await saveOne('plan_exercises', { ...pe, ...patch })
}

export async function removePlanExercise(pe: PlanExerciseRow): Promise<Change[]> {
  const targets = (
    await db.plan_set_targets.where('plan_exercise_id').equals(pe.id).toArray()
  ).filter(live)
  const changes = [
    ...targets.map((t) => deletion('plan_set_targets', t)),
    deletion('plan_exercises', pe),
  ]
  await save(changes)
  return changes
}

/** Replace all set targets for a planned exercise. */
export async function setTargets(pe: PlanExerciseRow, next: TargetLike[]): Promise<void> {
  const current = (
    await db.plan_set_targets.where('plan_exercise_id').equals(pe.id).toArray()
  ).filter(live)
  const c = ctx()
  // Reuse existing rows in place where possible (keeps ids stable for logged sets).
  const changes: Change[] = next.map((t, i) => {
    const prev = current[i]
    return prev
      ? { table: 'plan_set_targets', row: { ...prev, ...t, order: i } }
      : { table: 'plan_set_targets', row: newTargetRow(c, pe.id, i, t) }
  })
  for (const extra of current.slice(next.length)) changes.push(deletion('plan_set_targets', extra))
  await save(changes)
}

/** Superset this exercise with the next one (joining an existing group if either has one). */
export async function linkWithNext(list: PlanExerciseRow[], index: number): Promise<void> {
  const a = list[index]
  const b = list[index + 1]
  if (!a || !b) return
  const groupId = a.group_id ?? b.group_id ?? newId()
  const members = list.filter((e) => e.group_id === groupId || e.id === a.id || e.id === b.id)
  const type = members.length >= 3 ? 'giant' : 'superset'
  await save(
    members.map((e) => ({
      table: 'plan_exercises' as const,
      row: { ...e, group_id: groupId, group_type: type },
    })),
  )
}

export async function unlinkGroup(list: PlanExerciseRow[], pe: PlanExerciseRow): Promise<void> {
  if (!pe.group_id) return
  const members = list.filter((e) => e.group_id === pe.group_id)
  await save(
    members.map((e) => ({
      table: 'plan_exercises' as const,
      row: { ...e, group_id: null, group_type: null },
    })),
  )
}

// --- Versions ---

/** Saves a new version if the plan differs from its latest saved version. */
export async function snapshotIfChanged(
  planId: string,
  note: string | null = null,
): Promise<boolean> {
  const rows = await loadPlanRows(planId)
  if (!rows) return false
  const snap = buildSnapshot(rows)
  const versions = (await db.plan_versions.where('plan_id').equals(planId).toArray()).filter(live)
  const latest = versions.toSorted((a, b) => b.version - a.version)[0]
  if (latest && snapshotKey(snapshotFromJson(latest.snapshot_json)) === snapshotKey(snap))
    return false

  const c = ctx()
  const version = (latest?.version ?? 0) + 1
  await save([
    {
      table: 'plan_versions',
      row: {
        id: c.newId(),
        user_id: c.userId,
        plan_id: planId,
        version,
        snapshot_json: snapshotToJson(snap),
        note,
        created_at: c.now,
        updated_at: c.now,
        deleted_at: null,
      },
    },
    { table: 'plans', row: { ...rows.plan, current_version: version } },
  ])
  return true
}

export async function restoreVersion(v: PlanVersionRow): Promise<void> {
  const current = await loadPlanRows(v.plan_id)
  if (!current) return
  // Save the present state first so the restore itself can be undone.
  await snapshotIfChanged(v.plan_id, 'Before restore')
  const fresh = (await loadPlanRows(v.plan_id))!
  const r = planRestore(snapshotFromJson(v.snapshot_json), fresh)
  const now = nowIso()
  const restored = <T extends object>(row: T) => ({ ...row, updated_at: now, deleted_at: null })
  await save([
    { table: 'plans', row: { ...fresh.plan, ...r.planPatch } },
    ...r.upserts.sessions.map((row) => ({ table: 'plan_sessions' as const, row: restored(row) })),
    ...r.upserts.schedule.map((row) => ({ table: 'plan_schedule' as const, row: restored(row) })),
    ...r.upserts.exercises.map((row) => ({ table: 'plan_exercises' as const, row: restored(row) })),
    ...r.upserts.targets.map((row) => ({ table: 'plan_set_targets' as const, row: restored(row) })),
    ...r.deletions.targets.map((row) => deletion('plan_set_targets', row)),
    ...r.deletions.exercises.map((row) => deletion('plan_exercises', row)),
    ...r.deletions.schedule.map((row) => deletion('plan_schedule', row)),
    ...r.deletions.sessions.map((row) => deletion('plan_sessions', row)),
  ])
  await snapshotIfChanged(v.plan_id, `Restored version ${v.version}`)
}

// --- Workouts from plans, and edits made during a workout ---

/** Starts a workout pre-loaded with a planned workout's exercises (sets stay blank). */
export async function startFromPlan(
  planSession: PlanSessionRow,
  past?: { startedAt: string; endedAt: string },
): Promise<string> {
  const c = ctx()
  const exercises = (
    await db.plan_exercises.where('plan_session_id').equals(planSession.id).toArray()
  )
    .filter(live)
    .toSorted(byOrder)
  const session: Session = {
    id: c.newId(),
    user_id: c.userId,
    plan_id: planSession.plan_id,
    plan_session_id: planSession.id,
    name: planSession.name,
    started_at: past?.startedAt ?? c.now,
    ended_at: past?.endedAt ?? null,
    notes: null,
    created_at: c.now,
    updated_at: c.now,
    deleted_at: null,
  }
  const items: SessionExercise[] = exercises.map((pe, i) => ({
    id: c.newId(),
    user_id: c.userId,
    session_id: session.id,
    exercise_id: pe.exercise_id,
    plan_exercise_id: pe.id,
    order: i,
    group_id: pe.group_id,
    group_type: pe.group_type,
    rest_seconds: pe.rest_seconds,
    notes: null,
    created_at: c.now,
    updated_at: c.now,
    deleted_at: null,
  }))
  await save([
    { table: 'sessions', row: session },
    ...items.map((row) => ({ table: 'session_exercises' as const, row })),
  ])
  return session.id
}

/** "Also add to plan": puts an exercise added mid-workout into the plan session too. */
export async function addWorkoutExerciseToPlan(
  se: SessionExercise,
  planSessionId: string,
  exercise: Exercise,
  logType: LogType,
): Promise<void> {
  const peId = await addPlanExercise(planSessionId, exercise, logType)
  await saveOne('session_exercises', { ...se, plan_exercise_id: peId })
  const session = await db.plan_sessions.get(planSessionId)
  if (session) await snapshotIfChanged(session.plan_id, `Added ${exercise.name} during a workout`)
}

/** "Also remove from plan". */
export async function removeFromPlan(planExerciseId: string, exerciseName: string): Promise<void> {
  const pe = await db.plan_exercises.get(planExerciseId)
  if (!pe || pe.deleted_at) return
  await removePlanExercise(pe)
  const session = await db.plan_sessions.get(pe.plan_session_id)
  if (session) await snapshotIfChanged(session.plan_id, `Removed ${exerciseName} during a workout`)
}

/** Swap the exercise in today's workout; optionally make the swap permanent in the plan. */
export async function swapExercise(
  se: SessionExercise,
  replacement: Exercise,
  alsoInPlan: boolean,
): Promise<void> {
  await saveOne('session_exercises', { ...se, exercise_id: replacement.id })
  if (!alsoInPlan || !se.plan_exercise_id) return
  const pe = await db.plan_exercises.get(se.plan_exercise_id)
  if (!pe || pe.deleted_at) return
  // Keep the old exercise as a swap option
  const alternatives = [...new Set([pe.exercise_id, ...pe.alternatives])].filter(
    (id) => id !== replacement.id,
  )
  await saveOne('plan_exercises', { ...pe, exercise_id: replacement.id, alternatives })
  const session = await db.plan_sessions.get(pe.plan_session_id)
  if (session) await snapshotIfChanged(session.plan_id, `Swapped to ${replacement.name}`)
}

// --- Goals ---

export async function updateProfile(profile: Profile, patch: Partial<Profile>): Promise<void> {
  await saveOne('profiles', { ...profile, ...patch })
}

export async function setMuscleFlags(
  target: MuscleTarget,
  patch: Partial<Pick<MuscleTarget, 'priority' | 'paused'>>,
): Promise<void> {
  await saveOne('muscle_targets', { ...target, ...patch })
}

// --- Leaving a workout ---

/** Deletes a workout with nothing logged. Returns true if it did. */
export async function discardIfEmpty(sessionId: string): Promise<boolean> {
  const session = await db.sessions.get(sessionId)
  if (!session || session.deleted_at || session.ended_at) return false
  const [sets, cardio, items] = await Promise.all([
    db.sets.where('session_id').equals(sessionId).toArray(),
    db.cardio_entries.where('session_id').equals(sessionId).toArray(),
    db.session_exercises.where('session_id').equals(sessionId).toArray(),
  ])
  if (sets.some(live) || cardio.some(live)) return false
  await save([
    ...items.filter(live).map((i) => deletion('session_exercises', i)),
    deletion('sessions', session),
  ])
  return true
}
