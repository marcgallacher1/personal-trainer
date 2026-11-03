export type SetType = 'warmup' | 'working' | 'drop' | 'failure'

export const SET_TYPES: readonly SetType[] = ['working', 'warmup', 'drop', 'failure']

/** How an exercise is logged; drives the logging UI, formatting and PB rules. */
export type LogType =
  /** Weight (kg) × reps, e.g. bench press */
  | 'weight_reps'
  /** Reps at bodyweight; weight_kg = optional ADDED weight, e.g. dips, ab wheel */
  | 'bodyweight_reps'
  /** weight_kg = machine ASSISTANCE (less is harder), e.g. assisted pull-up */
  | 'assisted_reps'
  /** Hold time; weight_kg = optional added weight, e.g. plank */
  | 'duration'
  /** Weight (kg) for time, e.g. farmer's walk */
  | 'weight_duration'

export const LOG_TYPES: readonly LogType[] = [
  'weight_reps',
  'bodyweight_reps',
  'assisted_reps',
  'duration',
  'weight_duration',
]

/** What the weight means. */
export type LoadMode =
  /** The whole load, e.g. 60 kg on the bar (bar included) */
  | 'total'
  /** Each of two dumbbells or handles: 20 kg = two 20s */
  | 'per_hand'
  /** Single-arm/leg: left in weight_kg/reps, right in right_weight_kg/right_reps */
  | 'per_side'

export const LOAD_MODES: readonly LoadMode[] = ['total', 'per_hand', 'per_side']

export const asLoadMode = (v: string | null | undefined): LoadMode =>
  (LOAD_MODES as readonly string[]).includes(v ?? '') ? (v as LoadMode) : 'total'

export const isTimed = (t: LogType): boolean => t === 'duration' || t === 'weight_duration'

/** The subset of a logged set the pure logging functions need. */
export interface LoggedSet {
  id: string
  session_id: string
  order: number
  weight_kg: number
  reps: number
  duration_seconds: number | null
  rir: number | null
  set_type: SetType
  completed_at: string
  deleted_at: string | null
  /** Right side, for single-arm/leg moves */
  right_weight_kg?: number | null
  right_reps?: number | null
}

/** An unlogged, editable set row. */
export interface DraftSet {
  weight_kg: number
  reps: number
  duration_seconds: number | null
  set_type: SetType
  right_weight_kg?: number | null
  right_reps?: number | null
}
