import { beforeAll, describe, expect, it } from 'vitest'
import {
  addExercise,
  deleteSet,
  finishSession,
  logSet,
  saveCardio,
  startSession,
} from '../features/log/actions'
import { saveCustomExercise } from '../features/exercises/actions'
import {
  discardIfEmpty,
  loadPlanRows,
  restoreVersion,
  savePlanFromDraft,
  setPlanActive,
  snapshotIfChanged,
  startFromPlan,
  togglePlanDay,
  updatePlanSession,
} from '../features/plans/data'
import { applyFix } from '../features/plans/rating'
import { toggleDraftDay, type DraftItem } from '../lib/plans/draft'
import { db } from './local'
import { supabase } from './supabase'
import { clearLocalData, pull, push } from './sync'
import { setCurrentUserId } from './user'

/** Log offline, upload, wipe, download again. Needs `supabase start`. */
describe('offline log → push → wipe → pull', () => {
  beforeAll(async () => {
    const email = `it-${Date.now()}@test.local`
    const { data, error } = await supabase.auth.signUp({ email, password: 'integration-pass-1' })
    if (error || !data.user) throw error ?? new Error('no user')
    setCurrentUserId(data.user.id)
    await clearLocalData()
    await pull() // reference data: muscles + seeded exercises
  })

  it('round-trips a workout with sets, a PR, a deletion and a custom exercise', async () => {
    const bench = (await db.exercises.toArray()).find((e) => e.name === 'Barbell Bench Press')!
    expect(bench).toBeDefined()

    // Session 1
    const s1 = await startSession()
    await addExercise(s1, bench)
    const se1 = (await db.session_exercises.where('session_id').equals(s1).toArray())[0]!
    await logSet(se1, { weight_kg: 60, reps: 10, duration_seconds: null, set_type: 'warmup' }, null)
    await logSet(se1, { weight_kg: 100, reps: 5, duration_seconds: null, set_type: 'working' }, 2)
    await logSet(se1, { weight_kg: 100, reps: 5, duration_seconds: null, set_type: 'working' }, 1)
    await finishSession((await db.sessions.get(s1))!)

    // Session 2 beats it → PR
    const s2 = await startSession()
    await addExercise(s2, bench)
    const se2 = (await db.session_exercises.where('session_id').equals(s2).toArray())[0]!
    const { prs } = await logSet(
      se2,
      { weight_kg: 105, reps: 5, duration_seconds: null, set_type: 'working' },
      1,
    )
    expect(prs.map((p) => p.kind)).toContain('e1rm')
    const { prs: extra } = await logSet(
      se2,
      { weight_kg: 40, reps: 3, duration_seconds: null, set_type: 'working' },
      null,
    )
    expect(extra).toEqual([])
    const toDelete = (await db.sets.where('session_id').equals(s2).toArray()).find(
      (s) => s.weight_kg === 40,
    )!
    await deleteSet(toDelete)

    // Custom exercise with mapping
    const custom = await saveCustomExercise({
      name: `Test Curl ${Date.now()}`,
      equipment: 'cable',
      pattern: 'isolation',
      logType: 'weight_reps',
      muscles: { biceps: 'primary', forearms: 'secondary' },
    })

    // Cardio in session 2 (optional fields left empty)
    await saveCardio(s2, {
      activity: 'row',
      duration_seconds: 900,
      calories: 180,
      distance_km: null,
      avg_hr: null,
      notes: null,
    })

    // Timed hold: plank is seeded as a duration exercise
    const plank = (await db.exercises.toArray()).find((e) => e.name === 'Plank')!
    expect(plank.log_type).toBe('duration')
    await addExercise(s2, plank)
    const sePlank = (await db.session_exercises.where('session_id').equals(s2).toArray()).find(
      (se) => se.exercise_id === plank.id,
    )!
    await logSet(
      sePlank,
      { weight_kg: 0, reps: 0, duration_seconds: 75, set_type: 'working' },
      null,
      'duration',
    )

    expect(await db.outbox.count()).toBeGreaterThan(0)
    await push()
    expect(await db.outbox.count()).toBe(0)

    // Server has it all, scoped to this user by RLS
    const { data: serverSets } = await supabase.from('sets').select('*').in('session_id', [s1, s2])
    expect(serverSets).toHaveLength(6)
    expect(serverSets!.filter((s) => s.deleted_at)).toHaveLength(1)
    expect(serverSets!.find((s) => s.weight_kg === 105)?.is_pr).toBe(true)
    expect(serverSets!.find((s) => s.exercise_id === plank.id)?.duration_seconds).toBe(75)
    const { data: mapping } = await supabase
      .from('exercise_muscles')
      .select('*')
      .eq('exercise_id', custom.id)
    expect(mapping?.map((m) => [m.muscle_id, m.weight]).toSorted()).toEqual([
      ['biceps', 1],
      ['forearms', 0.5],
    ])
    const { data: serverCardio } = await supabase
      .from('cardio_entries')
      .select('*')
      .eq('session_id', s2)
    expect(serverCardio?.map((c) => [c.activity, c.duration_seconds, c.calories])).toEqual([
      ['row', 900, 180],
    ])

    // New device: wipe and pull
    await clearLocalData()
    expect(await db.sets.count()).toBe(0)
    await pull()
    const sets = (await db.sets.toArray()).filter((s) => [s1, s2].includes(s.session_id))
    expect(sets).toHaveLength(6)
    expect(sets.filter((s) => !s.deleted_at)).toHaveLength(5)
    expect((await db.sessions.get(s1))?.ended_at).not.toBeNull()
    expect((await db.exercises.get(custom.id))?.is_custom).toBe(true)
    expect(await db.exercises.count()).toBeGreaterThanOrEqual(141)
    expect(await db.cardio_entries.where('session_id').equals(s2).count()).toBe(1)
  })

  it('keeps un-pushed local edits when a pull brings older server data', async () => {
    const s = (await db.sessions.toArray())[0]!
    // Local edit not yet pushed…
    await db.transaction('rw', db.sessions, db.outbox, async () => {
      await db.sessions.put({ ...s, notes: 'local edit' })
      await db.outbox.add({
        table: 'sessions',
        key: s.id,
        row: { ...s, notes: 'local edit' },
        queuedAt: Date.now(),
        attempts: 0,
      })
    })
    await db.meta.delete('cursor:sessions') // force a full re-pull
    await pull()
    expect((await db.sessions.get(s.id))?.notes).toBe('local edit')
    await push()
    const { data } = await supabase.from('sessions').select('notes').eq('id', s.id).single()
    expect(data?.notes).toBe('local edit')
  })
})

describe('plans round-trip', () => {
  it('builds a plan the way the user does: Push A on Mon, Pull A on Tue, own workout on Fri', async () => {
    let draft: DraftItem[] = []
    draft = toggleDraftDay(draft, { kind: 'preset', templateId: 'push', version: 'A' }, 1).draft
    draft = toggleDraftDay(draft, { kind: 'preset', templateId: 'pull', version: 'A' }, 2).draft
    draft = toggleDraftDay(draft, { kind: 'custom', name: 'Arms' }, 5).draft
    const planId = await savePlanFromDraft('My plan', draft, true)

    const rows = (await loadPlanRows(planId))!
    expect(rows.plan.is_active).toBe(true)
    expect(rows.sessions.map((s) => s.name)).toEqual(['Push A', 'Pull A', 'Arms'])
    expect(rows.schedule.map((s) => s.weekday).toSorted()).toEqual([1, 2, 5])

    // Add Push B on Thursday to the saved plan, then untick it
    expect(
      await togglePlanDay(planId, { kind: 'preset', templateId: 'push', version: 'B' }, 4),
    ).toBe('added')
    expect((await loadPlanRows(planId))!.sessions.map((s) => s.name)).toContain('Push B')
    expect(
      await togglePlanDay(planId, { kind: 'preset', templateId: 'push', version: 'B' }, 4),
    ).toBe('removed')

    // Active is optional and easy to switch off
    await setPlanActive(rows.plan, false)
    expect((await db.plans.get(planId))?.is_active).toBe(false)
    await setPlanActive(rows.plan, true)
    expect((await db.plans.get(planId))?.is_active).toBe(true)

    // Start Push A from the plan
    const workoutId = await startFromPlan(rows.sessions[0]!)
    expect((await db.sessions.get(workoutId))?.name).toBe('Push A')
    const items = await db.session_exercises.where('session_id').equals(workoutId).toArray()
    expect(items).toHaveLength(7)

    // Versions: edit then restore
    await updatePlanSession(rows.sessions[0]!, { notes: 'Heavier this block' })
    expect(await snapshotIfChanged(planId, 'Edited')).toBe(true)
    const versions = (await db.plan_versions.where('plan_id').equals(planId).toArray()).toSorted(
      (a, b) => a.version - b.version,
    )
    await restoreVersion(versions[0]!)
    expect((await loadPlanRows(planId))!.sessions[0]!.notes).toMatch(/Chest, shoulders/)

    await push()
    expect(await db.outbox.count()).toBe(0)

    // New device: pull, and the server copy isn't seen as "changed"
    await clearLocalData()
    await pull()
    const pulled = (await loadPlanRows(planId))!
    // Restoring version 1 brought the plan back to before Push B was added
    expect(pulled.sessions.map((s) => s.name)).toEqual(['Push A', 'Pull A', 'Arms'])
    expect(await snapshotIfChanged(planId)).toBe(false)
  })

  it('activating one plan switches the others off', async () => {
    const draft = toggleDraftDay([], { kind: 'custom', name: 'Back' }, 3).draft
    const a = await savePlanFromDraft('Plan A', draft, true)
    const b = await savePlanFromDraft('Plan B', draft, true)
    expect((await db.plans.get(a))?.is_active).toBe(false)
    expect((await db.plans.get(b))?.is_active).toBe(true)
    await push() // the server's one-active-plan rule accepts the order of writes
    expect(await db.outbox.count()).toBe(0)
  })

  it('applies the spacing fixes: move a day, and regroup exercises between workouts', async () => {
    let draft: DraftItem[] = []
    draft = toggleDraftDay(draft, { kind: 'preset', templateId: 'push', version: 'A' }, 1).draft
    draft = toggleDraftDay(draft, { kind: 'preset', templateId: 'pull', version: 'A' }, 2).draft
    const planId = await savePlanFromDraft('Spacing', draft, false)
    const rows = (await loadPlanRows(planId))!
    const [pushW, pullW] = rows.sessions
    const pulldown = rows.exercises.find((e) => e.plan_session_id === pullW!.id)!

    await applyFix(planId, {
      kind: 'move',
      id: 'm',
      text: '',
      workoutId: pullW!.id,
      fromDay: 2,
      toDay: 4,
    })
    await applyFix(planId, {
      kind: 'regroup',
      id: 'r',
      text: '',
      moves: [{ planExerciseId: pulldown.id, toWorkoutId: pushW!.id }],
    })

    const after = (await loadPlanRows(planId))!
    expect(
      after.schedule.filter((d) => d.plan_session_id === pullW!.id).map((d) => d.weekday),
    ).toEqual([4])
    const moved = after.exercises.find((e) => e.id === pulldown.id)!
    expect(moved.plan_session_id).toBe(pushW!.id)
    // Goes to the end of its new workout
    expect(moved.order).toBe(
      Math.max(
        ...after.exercises.filter((e) => e.plan_session_id === pushW!.id).map((e) => e.order),
      ),
    )
    await push()
    expect(await db.outbox.count()).toBe(0)
  })

  it('cancels an empty workout on leaving, but keeps one with sets', async () => {
    const empty = await startSession()
    expect(await discardIfEmpty(empty)).toBe(true)
    expect((await db.sessions.get(empty))?.deleted_at).not.toBeNull()

    const used = await startSession()
    const bench = (await db.exercises.toArray()).find((e) => e.name === 'Barbell Bench Press')!
    await addExercise(used, bench)
    const se = (await db.session_exercises.where('session_id').equals(used).toArray())[0]!
    await logSet(se, { weight_kg: 60, reps: 8, duration_seconds: null, set_type: 'working' }, null)
    expect(await discardIfEmpty(used)).toBe(false)
    expect((await db.sessions.get(used))?.deleted_at).toBeNull()
  })
})
