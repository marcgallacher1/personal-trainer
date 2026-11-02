import { Dexie, type EntityTable } from 'dexie'
import type { Tables } from './database.types'

/** On-device database. The UI uses this; sync copies it to Supabase. Table names match Postgres. */

/** Tables the client writes and pushes via the outbox. */
export const SYNCED_TABLES = [
  'exercises',
  'exercise_muscles',
  'profiles',
  'muscle_targets',
  'plans',
  'plan_versions',
  'plan_sessions',
  'plan_schedule',
  'plan_exercises',
  'plan_set_targets',
  'plan_ratings',
  'plan_changes',
  'sessions',
  'session_exercises',
  'sets',
  'cardio_entries',
  'weekly_reports',
  'protein_logs',
  'bodyweight_logs',
  'notification_rules',
] as const
export type SyncedTable = (typeof SYNCED_TABLES)[number]

export interface OutboxEntry {
  seq?: number
  table: SyncedTable
  /** Row primary key, serialised (composite keys joined with '|'). */
  key: string
  row: Record<string, unknown>
  queuedAt: number
  attempts: number
  lastError?: string
}

export interface MetaEntry {
  key: string
  value: unknown
}

type ExerciseMuscleRow = Tables<'exercise_muscles'> & { key: string }
type MuscleTargetRow = Tables<'muscle_targets'> & { key: string }

export class TrainerDB extends Dexie {
  muscles!: EntityTable<Tables<'muscles'>, 'id'>
  exercises!: EntityTable<Tables<'exercises'>, 'id'>
  exercise_muscles!: EntityTable<ExerciseMuscleRow, 'key'>
  profiles!: EntityTable<Tables<'profiles'>, 'id'>
  muscle_targets!: EntityTable<MuscleTargetRow, 'key'>
  plans!: EntityTable<Tables<'plans'>, 'id'>
  plan_versions!: EntityTable<Tables<'plan_versions'>, 'id'>
  plan_sessions!: EntityTable<Tables<'plan_sessions'>, 'id'>
  plan_schedule!: EntityTable<Tables<'plan_schedule'>, 'id'>
  plan_exercises!: EntityTable<Tables<'plan_exercises'>, 'id'>
  plan_set_targets!: EntityTable<Tables<'plan_set_targets'>, 'id'>
  plan_ratings!: EntityTable<Tables<'plan_ratings'>, 'id'>
  plan_changes!: EntityTable<Tables<'plan_changes'>, 'id'>
  sessions!: EntityTable<Tables<'sessions'>, 'id'>
  session_exercises!: EntityTable<Tables<'session_exercises'>, 'id'>
  sets!: EntityTable<Tables<'sets'>, 'id'>
  cardio_entries!: EntityTable<Tables<'cardio_entries'>, 'id'>
  weekly_reports!: EntityTable<Tables<'weekly_reports'>, 'id'>
  protein_logs!: EntityTable<Tables<'protein_logs'>, 'id'>
  bodyweight_logs!: EntityTable<Tables<'bodyweight_logs'>, 'id'>
  notification_rules!: EntityTable<Tables<'notification_rules'>, 'id'>
  outbox!: EntityTable<OutboxEntry, 'seq'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor(name = 'trainer') {
    super(name)
    // Only indexed fields are listed; rows store every column.
    this.version(1).stores({
      muscles: 'id',
      exercises: 'id, user_id, name, pattern, updated_at',
      exercise_muscles: 'key, exercise_id, muscle_id, updated_at',
      profiles: 'id',
      muscle_targets: 'key, muscle_id',
      plans: 'id, is_active, updated_at',
      plan_versions: 'id, plan_id, [plan_id+version]',
      plan_sessions: 'id, plan_id',
      plan_schedule: 'id, plan_id, plan_session_id',
      plan_exercises: 'id, plan_session_id, exercise_id',
      plan_set_targets: 'id, plan_exercise_id',
      plan_ratings: 'id, plan_id',
      plan_changes: 'id, plan_id, status',
      sessions: 'id, started_at, plan_session_id, updated_at',
      session_exercises: 'id, session_id, exercise_id',
      sets: 'id, session_id, exercise_id, [exercise_id+completed_at], completed_at',
      weekly_reports: 'id, iso_week',
      protein_logs: 'id, date',
      bodyweight_logs: 'id, date',
      notification_rules: 'id, type',
      outbox: '++seq, table, key',
      meta: 'key',
    })
    // v2: cardio inside workouts
    this.version(2).stores({
      cardio_entries: 'id, session_id, completed_at',
    })
  }
}

export const db = new TrainerDB()
