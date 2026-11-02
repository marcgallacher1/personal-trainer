import type { Json } from '../../db/database.types'
import type {
  PlanExerciseRow,
  PlanRow,
  PlanRows,
  PlanScheduleRow,
  PlanSessionRow,
  PlanSetTargetRow,
} from './instantiate'

/** A plan's full contents at a point in time (live rows only, bookkeeping stripped). */
export interface PlanSnapshot {
  plan: Pick<PlanRow, 'name' | 'notes' | 'schedule_mode'>
  sessions: Omit<PlanSessionRow, 'updated_at' | 'deleted_at'>[]
  schedule: Omit<PlanScheduleRow, 'updated_at' | 'deleted_at'>[]
  exercises: Omit<PlanExerciseRow, 'updated_at' | 'deleted_at'>[]
  targets: Omit<PlanSetTargetRow, 'updated_at' | 'deleted_at'>[]
}

type Live = { deleted_at: string | null; id: string }

function strip<T extends { updated_at: string; deleted_at: string | null }>(
  row: T,
): Omit<T, 'updated_at' | 'deleted_at'> {
  const { updated_at: _u, deleted_at: _d, ...rest } = row
  return rest
}

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)

const liveSorted = <T extends Live>(xs: T[]) =>
  xs.filter((x) => x.deleted_at === null).toSorted(byId)

export function buildSnapshot(rows: PlanRows): PlanSnapshot {
  return {
    plan: { name: rows.plan.name, notes: rows.plan.notes, schedule_mode: rows.plan.schedule_mode },
    sessions: liveSorted(rows.sessions).map(strip),
    schedule: liveSorted(rows.schedule).map(strip),
    exercises: liveSorted(rows.exercises).map(strip),
    targets: liveSorted(rows.targets).map(strip),
  }
}

/** JSON with sorted keys and no created_at, so server and device copies compare equal. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return `{${Object.keys(obj)
      .filter((k) => k !== 'created_at')
      .toSorted()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

/** Stable comparison key: two snapshots with equal keys describe the same plan. */
export function snapshotKey(s: PlanSnapshot): string {
  return stableStringify(s)
}

export function summariseSnapshot(s: PlanSnapshot): string {
  const sets = s.targets.filter((t) => t.set_type !== 'warmup').length
  return `${s.sessions.length} session${s.sessions.length === 1 ? '' : 's'} · ${s.exercises.length} exercises · ${sets} sets`
}

export interface RestorePlan {
  planPatch: PlanSnapshot['plan']
  /** Rows to upsert (as they were in the snapshot, un-deleted) */
  upserts: {
    sessions: PlanSnapshot['sessions']
    schedule: PlanSnapshot['schedule']
    exercises: PlanSnapshot['exercises']
    targets: PlanSnapshot['targets']
  }
  /** Current live rows that didn't exist in the snapshot → soft-delete */
  deletions: {
    sessions: PlanSessionRow[]
    schedule: PlanScheduleRow[]
    exercises: PlanExerciseRow[]
    targets: PlanSetTargetRow[]
  }
}

/** Live rows in `xs` whose id is not among `keep`. */
function notIn<T extends Live>(xs: T[], keep: { id: string }[]): T[] {
  const ids = new Set(keep.map((k) => k.id))
  return xs.filter((x) => x.deleted_at === null && !ids.has(x.id))
}

/** What to write to turn the current plan back into `snapshot`. */
export function planRestore(snapshot: PlanSnapshot, current: PlanRows): RestorePlan {
  return {
    planPatch: snapshot.plan,
    upserts: {
      sessions: snapshot.sessions,
      schedule: snapshot.schedule,
      exercises: snapshot.exercises,
      targets: snapshot.targets,
    },
    deletions: {
      sessions: notIn(current.sessions, snapshot.sessions),
      schedule: notIn(current.schedule, snapshot.schedule),
      exercises: notIn(current.exercises, snapshot.exercises),
      targets: notIn(current.targets, snapshot.targets),
    },
  }
}

export const snapshotToJson = (s: PlanSnapshot): Json => s as unknown as Json
export const snapshotFromJson = (j: Json): PlanSnapshot => j as unknown as PlanSnapshot
