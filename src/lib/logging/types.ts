export type SetType = 'warmup' | 'working' | 'drop' | 'failure'

export const SET_TYPES: readonly SetType[] = ['working', 'warmup', 'drop', 'failure']

/** The subset of a logged set the pure logging functions need. */
export interface LoggedSet {
  id: string
  session_id: string
  order: number
  weight_kg: number
  reps: number
  rir: number | null
  set_type: SetType
  completed_at: string
  deleted_at: string | null
}

/** An unlogged, editable set row. */
export interface DraftSet {
  weight_kg: number
  reps: number
  set_type: SetType
}
