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
  createPlanFromTemplate,
  discardIfEmpty,
  loadPlanRows,
  restoreVersion,
  snapshotIfChanged,
  splitPlan,
  startFromPlan,
  updatePlanSession,
} from '../features/plans/data'
import { TEMPLATES } from '../lib/plans/templates'
import { db } from './local'
import { supabase } from './supabase'
import { clearLocalData, pull, push } from './sync'
import { setCurrentUserId } from './user'
import { save } from './write'

/**
 * End-to-end: log a workout "offline" into IndexedDB, push it through RLS to the local Supabase,
 * wipe the device, pull it back. Requires `supabase start` and VITE_SUPABASE_* in the environment.
 */
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
  it('creates a plan from a preset, starts "Push A", versions and restores', async () => {
    const tpl = TEMPLATES.find((t) => t.id === 'push')!
    const planId = await createPlanFromTemplate(tpl)
    const rows = (await loadPlanRows(planId))!
    expect(rows.plan.name).toBe('Push')
    expect(rows.sessions.map((s) => s.name)).toEqual(['A', 'B'])
    expect(rows.exercises).toHaveLength(13)

    // Start Push A: named after plan + version, exercises pre-loaded and linked
    const workoutId = await startFromPlan(rows.sessions[0]!)
    expect((await db.sessions.get(workoutId))?.name).toBe('Push A')
    const items = await db.session_exercises.where('session_id').equals(workoutId).toArray()
    expect(items).toHaveLength(7)
    expect(items.every((i) => i.plan_exercise_id)).toBe(true)

    // Edit → new version on save; restore version 1
    await updatePlanSession(rows.sessions[0]!, { notes: 'Heavier this block' })
    expect(await snapshotIfChanged(planId, 'Edited')).toBe(true)
    const versions = (await db.plan_versions.where('plan_id').equals(planId).toArray()).toSorted(
      (a, b) => a.version - b.version,
    )
    expect(versions.map((v) => v.version)).toEqual([1, 2])
    await restoreVersion(versions[0]!)
    expect((await loadPlanRows(planId))!.sessions[0]!.notes).toMatch(/Chest, shoulders/)

    await push()
    expect(await db.outbox.count()).toBe(0)

    // New device: pull, and the server copy isn't seen as "changed"
    await clearLocalData()
    await pull()
    const pulled = (await loadPlanRows(planId))!
    expect(pulled.exercises).toHaveLength(13)
    expect(await snapshotIfChanged(planId)).toBe(false)
  })

  it('splits a legacy mixed plan into one plan per type, keeping history linked', async () => {
    const userId = (await supabase.auth.getUser()).data.user!.id
    const now = new Date().toISOString()
    const legacyId = crypto.randomUUID()
    const names = ['Push A', 'Pull A', 'Push B', 'Pull B']
    const sessionIds = names.map(() => crypto.randomUUID())
    const meta = { user_id: userId, created_at: now, updated_at: now, deleted_at: null }
    await save([
      {
        table: 'plans',
        row: {
          ...meta,
          id: legacyId,
          name: 'Upper focus · 4 days',
          goal: null,
          notes: null,
          is_active: false,
          schedule_mode: 'rotation',
          block_weeks: null,
          deload_week: null,
          block_start_date: null,
          rotation_anchor_date: null,
          current_version: 1,
          archived: false,
        },
      },
      ...names.map((name, i) => ({
        table: 'plan_sessions' as const,
        row: {
          ...meta,
          id: sessionIds[i]!,
          plan_id: legacyId,
          name,
          colour: null,
          emoji: null,
          notes: null,
          warmup_notes: null,
          est_minutes: null,
          order: i,
        },
      })),
    ])
    const legacy = (await db.plans.get(legacyId))!
    // A workout logged against "Pull B" before the split
    const workout = await startFromPlan((await db.plan_sessions.get(sessionIds[3]!))!)

    const created = await splitPlan(legacy)
    expect(created).toHaveLength(2)
    const pushPlan = (await loadPlanRows(created[0]!))!
    const pullPlan = (await loadPlanRows(created[1]!))!
    expect([pushPlan.plan.name, pullPlan.plan.name]).toEqual(['Push', 'Pull'])
    expect(pushPlan.sessions.map((s) => s.name)).toEqual(['A', 'B'])
    expect(pullPlan.sessions.map((s) => [s.id, s.name])).toEqual([
      [sessionIds[1], 'A'],
      [sessionIds[3], 'B'],
    ])
    expect((await db.plans.get(legacyId))?.deleted_at).not.toBeNull()
    // The old workout still points at the same (moved) version
    expect((await db.sessions.get(workout))?.plan_session_id).toBe(sessionIds[3])

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
