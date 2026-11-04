import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/local'
import type { Tables } from '../../db/database.types'
import { requireUserId } from '../../db/user'
import { deletion, newId, nowIso, save, saveOne, type Change } from '../../db/write'
import type { Profile } from '../plans/data'

export type ProteinLog = Tables<'protein_logs'>
export type BodyweightLog = Tables<'bodyweight_logs'>

const live = (r: { deleted_at: string | null }) => r.deleted_at === null

export function useProteinLogs(): ProteinLog[] | undefined {
  return useLiveQuery(async () => (await db.protein_logs.toArray()).filter(live), [])
}

/** Weigh-ins, oldest first. */
export function useWeighIns(): BodyweightLog[] | undefined {
  return useLiveQuery(
    async () => (await db.bodyweight_logs.orderBy('date').toArray()).filter(live),
    [],
  )
}

export async function addProtein(date: string, grams: number, label: string | null) {
  const now = nowIso()
  const row: ProteinLog = {
    id: newId(),
    user_id: requireUserId(),
    date,
    grams,
    label,
    logged_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }
  await saveOne('protein_logs', row)
  return row
}

/** Deletes an entry; returns the change so it can be undone. */
export async function deleteProtein(row: ProteinLog): Promise<Change[]> {
  const changes = [deletion('protein_logs', row)]
  await save(changes)
  return changes
}

/**
 * Logs (or corrects) the weight for a day, and keeps the profile's weight current, which the
 * protein target and the server's reminders use.
 */
export async function logWeight(date: string, kg: number, profile: Profile | null) {
  const sameDay = (await db.bodyweight_logs.where('date').equals(date).toArray()).find(live)
  const now = nowIso()
  const row: BodyweightLog = sameDay
    ? { ...sameDay, kg }
    : {
        id: newId(),
        user_id: requireUserId(),
        date,
        kg,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      }
  const changes: Change[] = [{ table: 'bodyweight_logs', row }]
  // Only a newer (or same-day) weigh-in updates the profile
  const latest = (await db.bodyweight_logs.orderBy('date').toArray()).filter(live).at(-1)
  if (profile && (!latest || date >= latest.date))
    changes.push({ table: 'profiles', row: { ...profile, bodyweight_kg: kg } })
  await save(changes)
}

export async function setProteinPerKg(profile: Profile, gPerKg: number) {
  await saveOne('profiles', { ...profile, protein_g_per_kg: gPerKg })
}
