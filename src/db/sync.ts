import { db, SYNCED_TABLES, type OutboxEntry, type SyncedTable } from './local'
import { supabase } from './supabase'
import { localKey, withLocalKey } from './write'

/**
 * Two-way sync between IndexedDB and Supabase.
 * - push(): drains the outbox strictly in order with idempotent upserts (client-generated IDs).
 * - pull(): fetches rows changed since a per-table cursor (server-owned updated_at). Rows with
 *   un-pushed local edits are skipped, so local changes win until they've been uploaded.
 */

const CONFLICT_KEYS: Partial<Record<SyncedTable, string>> = {
  exercise_muscles: 'exercise_id,muscle_id',
  muscle_targets: 'user_id,muscle_id',
}

const PAGE = 1000
const EPOCH = '1970-01-01T00:00:00Z'

export class PushError extends Error {
  readonly entry: OutboxEntry
  constructor(message: string, entry: OutboxEntry) {
    super(message)
    this.entry = entry
  }
}

export async function push(): Promise<number> {
  let pushed = 0
  for (;;) {
    const entry = await db.outbox.orderBy('seq').first()
    if (!entry) return pushed
    const onConflict = CONFLICT_KEYS[entry.table] ?? 'id'
    // Server owns updated_at (pull cursor); `key` is local-only.
    const { updated_at: _u, key: _k, ...row } = entry.row
    const { error } = await supabase.from(entry.table).upsert(row as never, { onConflict })
    if (error) {
      await db.outbox.update(entry.seq!, { attempts: entry.attempts + 1, lastError: error.message })
      // Stop here: later writes may depend on this one (e.g. sets → session).
      throw new PushError(error.message, entry)
    }
    await db.outbox.delete(entry.seq!)
    pushed++
  }
}

async function pullTable(table: SyncedTable): Promise<void> {
  const cursorKey = `cursor:${table}`
  let cursor = ((await db.meta.get(cursorKey))?.value as string | undefined) ?? EPOCH

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gte('updated_at', cursor)
      .order('updated_at', { ascending: true })
      .limit(PAGE)
    if (error) throw new Error(`${table}: ${error.message}`)
    const rows = (data ?? []) as unknown as Record<string, unknown>[]
    if (rows.length === 0) return
    const last = String(rows.at(-1)!.updated_at)

    await db.transaction('rw', [db.table(table), db.outbox, db.meta], async () => {
      const pending = new Set(
        (await db.outbox.where('table').equals(table).toArray()).map((e) => e.key),
      )
      const fresh = rows
        .filter((r) => !pending.has(localKey(table, r)))
        .map((r) => withLocalKey(table, r))
      await db.table(table).bulkPut(fresh)
      await db.meta.put({ key: cursorKey, value: last })
    })

    if (rows.length < PAGE || last === cursor) return
    cursor = last
  }
}

export async function pull(): Promise<void> {
  if ((await db.muscles.count()) === 0) {
    const { data, error } = await supabase.from('muscles').select('*')
    if (error) throw new Error(`muscles: ${error.message}`)
    await db.muscles.bulkPut(data ?? [])
  }
  for (const table of SYNCED_TABLES) await pullTable(table)
}

/** Wipes local data, e.g. on sign-out or when a different account signs in on this device. */
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
  })
}

/** Ensures local data belongs to this user; clears it if another account used this device. */
export async function claimLocalData(userId: string): Promise<void> {
  const owner = (await db.meta.get('owner'))?.value
  if (owner && owner !== userId) await clearLocalData()
  await db.meta.put({ key: 'owner', value: userId })
}
