import { supabase } from './supabase'
import { db, type OutboxEntry, type SyncedTable } from './local'

/**
 * Sync worker — Phase 1 skeleton.
 * - push(): drains the outbox in order with idempotent upserts (client-generated IDs).
 * - pullReference(): caches muscles + exercise catalogue locally so the library works offline.
 * Phase 2 adds per-table pulls ("changes since cursor"), retry backoff, and the status pill.
 */

const CONFLICT_KEYS: Partial<Record<SyncedTable, string>> = {
  exercise_muscles: 'exercise_id,muscle_id',
  muscle_targets: 'user_id,muscle_id',
}

export async function push(): Promise<{ pushed: number; failed: number }> {
  const entries = await db.outbox.orderBy('seq').toArray()
  let pushed = 0
  let failed = 0
  for (const entry of entries) {
    const ok = await pushOne(entry)
    if (ok) pushed++
    else {
      failed++
      break // keep ordering: later writes may depend on this one (e.g. sets → session)
    }
  }
  return { pushed, failed }
}

async function pushOne(entry: OutboxEntry): Promise<boolean> {
  const onConflict = CONFLICT_KEYS[entry.table] ?? 'id'
  // Server owns updated_at (pull cursor); never send the client's copy.
  const { updated_at: _ignored, key: _localKey, ...row } = entry.row
  const { error } = await supabase.from(entry.table).upsert(row as never, { onConflict })
  if (error) {
    await db.outbox.update(entry.seq!, { attempts: entry.attempts + 1, lastError: error.message })
    return false
  }
  await db.outbox.delete(entry.seq!)
  return true
}

export async function pullReference(): Promise<{ exercises: number }> {
  const [muscles, exercises, mappings] = await Promise.all([
    supabase.from('muscles').select('*'),
    supabase.from('exercises').select('*').is('deleted_at', null),
    supabase.from('exercise_muscles').select('*'),
  ])
  const err = muscles.error ?? exercises.error ?? mappings.error
  if (err) throw new Error(err.message)

  await db.transaction('rw', [db.muscles, db.exercises, db.exercise_muscles, db.meta], async () => {
    await db.muscles.bulkPut(muscles.data ?? [])
    await db.exercises.bulkPut(exercises.data ?? [])
    await db.exercise_muscles.bulkPut(
      (mappings.data ?? []).map((m) => ({ ...m, key: `${m.exercise_id}|${m.muscle_id}` })),
    )
    await db.meta.put({ key: 'reference_pulled_at', value: new Date().toISOString() })
  })
  return { exercises: exercises.data?.length ?? 0 }
}
