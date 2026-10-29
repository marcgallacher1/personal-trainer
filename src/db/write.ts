import { uuidv7 } from 'uuidv7'
import { db, type SyncedTable } from './local'
import { requestSync } from './syncController'

type Row = Record<string, unknown>

export const newId = (): string => uuidv7()
export const nowIso = (): string => new Date().toISOString()

/** Primary key as stored locally. Composite-key tables get a synthetic `key` column. */
export function localKey(table: SyncedTable, row: Row): string {
  switch (table) {
    case 'exercise_muscles':
      return `${String(row.exercise_id)}|${String(row.muscle_id)}`
    case 'muscle_targets':
      return `${String(row.user_id)}|${String(row.muscle_id)}`
    default:
      return String(row.id)
  }
}

export function withLocalKey(table: SyncedTable, row: Row): Row {
  return table === 'exercise_muscles' || table === 'muscle_targets'
    ? { ...row, key: localKey(table, row) }
    : row
}

export interface Change {
  table: SyncedTable
  row: Row
}

/**
 * Write rows locally and queue them for upload in ONE IndexedDB transaction,
 * so a logged set can never exist locally without also being queued (or vice versa).
 */
export async function save(changes: Change[]): Promise<void> {
  if (changes.length === 0) return
  const tables = [...new Set(changes.map((c) => c.table))].map((t) => db.table(t))
  await db.transaction('rw', [...tables, db.outbox], async () => {
    for (const { table, row } of changes) {
      const stamped = withLocalKey(table, { ...row, updated_at: nowIso() })
      await db.table(table).put(stamped)
      await db.outbox.add({
        table,
        key: localKey(table, stamped),
        row: stamped,
        queuedAt: Date.now(),
        attempts: 0,
      })
    }
  })
  requestSync()
}

export const saveOne = (table: SyncedTable, row: Row): Promise<void> => save([{ table, row }])

/** Soft-delete (syncs like any other change and can be restored). */
export function deletion(table: SyncedTable, row: Row): Change {
  return { table, row: { ...row, deleted_at: nowIso() } }
}

export function restoration(table: SyncedTable, row: Row): Change {
  return { table, row: { ...row, deleted_at: null } }
}
