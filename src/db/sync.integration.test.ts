import { beforeAll, describe, expect, it } from 'vitest'
import {
  addExercise,
  deleteSet,
  finishSession,
  logSet,
  startSession,
} from '../features/log/actions'
import { saveCustomExercise } from '../features/exercises/actions'
import { db } from './local'
import { supabase } from './supabase'
import { clearLocalData, pull, push } from './sync'
import { setCurrentUserId } from './user'

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
    await logSet(se1, { weight_kg: 60, reps: 10, set_type: 'warmup' }, null)
    await logSet(se1, { weight_kg: 100, reps: 5, set_type: 'working' }, 2)
    await logSet(se1, { weight_kg: 100, reps: 5, set_type: 'working' }, 1)
    await finishSession((await db.sessions.get(s1))!)

    // Session 2 beats it → PR
    const s2 = await startSession()
    await addExercise(s2, bench)
    const se2 = (await db.session_exercises.where('session_id').equals(s2).toArray())[0]!
    const prs = await logSet(se2, { weight_kg: 105, reps: 5, set_type: 'working' }, 1)
    expect(prs.map((p) => p.kind)).toContain('e1rm')
    const extra = await logSet(se2, { weight_kg: 40, reps: 3, set_type: 'working' }, null)
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
      muscles: { biceps: 'primary', forearms: 'secondary' },
    })

    expect(await db.outbox.count()).toBeGreaterThan(0)
    await push()
    expect(await db.outbox.count()).toBe(0)

    // Server has it all, scoped to this user by RLS
    const { data: serverSets } = await supabase.from('sets').select('*').in('session_id', [s1, s2])
    expect(serverSets).toHaveLength(5)
    expect(serverSets!.filter((s) => s.deleted_at)).toHaveLength(1)
    expect(serverSets!.find((s) => s.weight_kg === 105)?.is_pr).toBe(true)
    const { data: mapping } = await supabase
      .from('exercise_muscles')
      .select('*')
      .eq('exercise_id', custom.id)
    expect(mapping?.map((m) => [m.muscle_id, m.weight]).toSorted()).toEqual([
      ['biceps', 1],
      ['forearms', 0.5],
    ])

    // New device: wipe and pull
    await clearLocalData()
    expect(await db.sets.count()).toBe(0)
    await pull()
    const sets = (await db.sets.toArray()).filter((s) => [s1, s2].includes(s.session_id))
    expect(sets).toHaveLength(5)
    expect(sets.filter((s) => !s.deleted_at)).toHaveLength(4)
    expect((await db.sessions.get(s1))?.ended_at).not.toBeNull()
    expect((await db.exercises.get(custom.id))?.is_custom).toBe(true)
    expect(await db.exercises.count()).toBeGreaterThanOrEqual(141)
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
