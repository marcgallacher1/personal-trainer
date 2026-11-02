import type { LogType } from '../logging/types'
import type { MuscleId } from './muscles'

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'smith'
  | 'other'

export type MovementPattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'carry'
  | 'core'
  | 'isolation'

export interface ExerciseSeed {
  name: string
  equipment: Equipment
  pattern: MovementPattern
  compound: boolean
  restSeconds: number
  /** How sets are logged (weight × reps, bodyweight, assisted, timed…) */
  logType: LogType
  /** Original name used to derive the stable seed ID, when the display name has since changed. */
  idName?: string
  /** Primary movers, weight 1.0 */
  primary: MuscleId[]
  /** Secondary movers, weight 0.5 */
  secondary: MuscleId[]
}

type Row = [
  name: string,
  equipment: Equipment,
  pattern: MovementPattern,
  primary: MuscleId[],
  secondary: MuscleId[],
]

// Rest defaults: compounds 180s, other multi-joint 120s, isolations 90s, core 60s.
const COMPOUND: Row[] = [
  // Horizontal push
  ['Barbell Bench Press', 'barbell', 'horizontal_push', ['chest'], ['front_delts', 'triceps']],
  [
    'Incline Barbell Bench Press',
    'barbell',
    'horizontal_push',
    ['chest'],
    ['front_delts', 'triceps'],
  ],
  ['Close-Grip Bench Press', 'barbell', 'horizontal_push', ['triceps'], ['chest', 'front_delts']],
  // Vertical push
  [
    'Overhead Press',
    'barbell',
    'vertical_push',
    ['front_delts'],
    ['side_delts', 'triceps', 'upper_back'],
  ],
  ['Push Press', 'barbell', 'vertical_push', ['front_delts'], ['triceps', 'quads', 'side_delts']],
  // Pulls
  [
    'Barbell Row',
    'barbell',
    'horizontal_pull',
    ['upper_back', 'lats'],
    ['rear_delts', 'biceps', 'lower_back'],
  ],
  [
    'Pendlay Row',
    'barbell',
    'horizontal_pull',
    ['upper_back', 'lats'],
    ['rear_delts', 'biceps', 'lower_back'],
  ],
  [
    'Weighted Pull-Up',
    'bodyweight',
    'vertical_pull',
    ['lats'],
    ['biceps', 'upper_back', 'rear_delts'],
  ],
  // Squat / hinge / lunge
  ['Back Squat', 'barbell', 'squat', ['quads', 'glutes'], ['adductors', 'lower_back']],
  ['Front Squat', 'barbell', 'squat', ['quads'], ['glutes', 'upper_back', 'abs']],
  [
    'Deadlift',
    'barbell',
    'hinge',
    ['glutes', 'hamstrings', 'lower_back'],
    ['upper_back', 'quads', 'forearms'],
  ],
  [
    'Sumo Deadlift',
    'barbell',
    'hinge',
    ['glutes', 'adductors'],
    ['hamstrings', 'quads', 'lower_back', 'upper_back'],
  ],
  ['Romanian Deadlift', 'barbell', 'hinge', ['hamstrings', 'glutes'], ['lower_back', 'forearms']],
  [
    'Trap Bar Deadlift',
    'other',
    'hinge',
    ['quads', 'glutes'],
    ['hamstrings', 'lower_back', 'upper_back'],
  ],
  ['Barbell Hip Thrust', 'barbell', 'hinge', ['glutes'], ['hamstrings']],
  ['Good Morning', 'barbell', 'hinge', ['hamstrings', 'lower_back'], ['glutes']],
  ['Barbell Lunge', 'barbell', 'lunge', ['quads', 'glutes'], ['adductors', 'hamstrings']],
  ['Hack Squat', 'machine', 'squat', ['quads'], ['glutes']],
  ['Leg Press', 'machine', 'squat', ['quads', 'glutes'], ['adductors']],
  ['Smith Machine Squat', 'smith', 'squat', ['quads', 'glutes'], ['adductors']],
]

const MULTI: Row[] = [
  // Horizontal push
  ['Dumbbell Bench Press', 'dumbbell', 'horizontal_push', ['chest'], ['front_delts', 'triceps']],
  ['Incline Dumbbell Press', 'dumbbell', 'horizontal_push', ['chest'], ['front_delts', 'triceps']],
  ['Decline Bench Press', 'barbell', 'horizontal_push', ['chest'], ['triceps', 'front_delts']],
  ['Machine Chest Press', 'machine', 'horizontal_push', ['chest'], ['front_delts', 'triceps']],
  ['Incline Machine Press', 'machine', 'horizontal_push', ['chest'], ['front_delts', 'triceps']],
  [
    'Smith Machine Incline Press',
    'smith',
    'horizontal_push',
    ['chest'],
    ['front_delts', 'triceps'],
  ],
  ['Push-Up', 'bodyweight', 'horizontal_push', ['chest'], ['front_delts', 'triceps', 'abs']],
  ['Dip', 'bodyweight', 'horizontal_push', ['chest', 'triceps'], ['front_delts']],
  ['Cable Chest Press', 'cable', 'horizontal_push', ['chest'], ['front_delts', 'triceps']],
  // Vertical push
  [
    'Seated Dumbbell Shoulder Press',
    'dumbbell',
    'vertical_push',
    ['front_delts'],
    ['side_delts', 'triceps'],
  ],
  ['Arnold Press', 'dumbbell', 'vertical_push', ['front_delts'], ['side_delts', 'triceps']],
  [
    'Machine Shoulder Press',
    'machine',
    'vertical_push',
    ['front_delts'],
    ['side_delts', 'triceps'],
  ],
  ['Landmine Press', 'barbell', 'vertical_push', ['front_delts'], ['chest', 'triceps']],
  ['Pike Push-Up', 'bodyweight', 'vertical_push', ['front_delts'], ['triceps']],
  // Horizontal pull
  [
    'One-Arm Dumbbell Row',
    'dumbbell',
    'horizontal_pull',
    ['lats', 'upper_back'],
    ['rear_delts', 'biceps'],
  ],
  [
    'Chest-Supported Dumbbell Row',
    'dumbbell',
    'horizontal_pull',
    ['upper_back'],
    ['lats', 'rear_delts', 'biceps'],
  ],
  [
    'Seated Cable Row',
    'cable',
    'horizontal_pull',
    ['upper_back', 'lats'],
    ['rear_delts', 'biceps'],
  ],
  [
    'T-Bar Row',
    'barbell',
    'horizontal_pull',
    ['upper_back', 'lats'],
    ['rear_delts', 'biceps', 'lower_back'],
  ],
  ['Machine Row', 'machine', 'horizontal_pull', ['upper_back', 'lats'], ['rear_delts', 'biceps']],
  ['Seal Row', 'barbell', 'horizontal_pull', ['upper_back'], ['lats', 'rear_delts', 'biceps']],
  [
    'Inverted Row',
    'bodyweight',
    'horizontal_pull',
    ['upper_back'],
    ['lats', 'rear_delts', 'biceps'],
  ],
  ['Meadows Row', 'barbell', 'horizontal_pull', ['lats', 'upper_back'], ['rear_delts', 'biceps']],
  // Vertical pull
  ['Pull-Up', 'bodyweight', 'vertical_pull', ['lats'], ['biceps', 'upper_back', 'rear_delts']],
  ['Chin-Up', 'bodyweight', 'vertical_pull', ['lats', 'biceps'], ['upper_back']],
  ['Lat Pulldown', 'cable', 'vertical_pull', ['lats'], ['biceps', 'upper_back']],
  ['Close-Grip Lat Pulldown', 'cable', 'vertical_pull', ['lats'], ['biceps', 'upper_back']],
  ['Single-Arm Cable Pulldown', 'cable', 'vertical_pull', ['lats'], ['biceps']],
  ['Assisted Pull-Up', 'machine', 'vertical_pull', ['lats'], ['biceps', 'upper_back']],
  ['Machine Pulldown', 'machine', 'vertical_pull', ['lats'], ['biceps', 'upper_back']],
  // Squat
  ['Goblet Squat', 'dumbbell', 'squat', ['quads'], ['glutes', 'adductors']],
  ['Pendulum Squat', 'machine', 'squat', ['quads'], ['glutes']],
  ['Belt Squat', 'machine', 'squat', ['quads', 'glutes'], ['adductors']],
  ['Safety Bar Squat', 'barbell', 'squat', ['quads', 'glutes'], ['upper_back', 'adductors']],
  // Hinge
  ['Dumbbell Romanian Deadlift', 'dumbbell', 'hinge', ['hamstrings', 'glutes'], ['lower_back']],
  ['Stiff-Leg Deadlift', 'barbell', 'hinge', ['hamstrings'], ['glutes', 'lower_back']],
  ['Kettlebell Swing', 'kettlebell', 'hinge', ['glutes', 'hamstrings'], ['lower_back']],
  ['Cable Pull-Through', 'cable', 'hinge', ['glutes'], ['hamstrings']],
  ['Machine Hip Thrust', 'machine', 'hinge', ['glutes'], ['hamstrings']],
  ['Glute Bridge', 'bodyweight', 'hinge', ['glutes'], ['hamstrings']],
  [
    'Rack Pull',
    'barbell',
    'hinge',
    ['upper_back', 'glutes'],
    ['lower_back', 'hamstrings', 'forearms'],
  ],
  // Lunge
  ['Bulgarian Split Squat', 'dumbbell', 'lunge', ['quads', 'glutes'], ['adductors']],
  ['Dumbbell Walking Lunge', 'dumbbell', 'lunge', ['quads', 'glutes'], ['adductors', 'hamstrings']],
  ['Reverse Lunge', 'dumbbell', 'lunge', ['glutes', 'quads'], ['hamstrings', 'adductors']],
  ['Step-Up', 'dumbbell', 'lunge', ['quads', 'glutes'], ['hamstrings']],
  ['Smith Machine Split Squat', 'smith', 'lunge', ['quads', 'glutes'], ['adductors']],
  ['Lateral Lunge', 'dumbbell', 'lunge', ['adductors', 'quads'], ['glutes']],
  // Carry
  ["Farmer's Walk", 'dumbbell', 'carry', ['forearms', 'upper_back'], ['abs', 'obliques']],
  ['Suitcase Carry', 'dumbbell', 'carry', ['obliques', 'forearms'], ['upper_back']],
  ['Trap Bar Carry', 'other', 'carry', ['forearms', 'upper_back'], ['abs', 'glutes']],
]

const ISOLATION: Row[] = [
  // Chest
  ['Dumbbell Fly', 'dumbbell', 'isolation', ['chest'], ['front_delts']],
  ['Incline Dumbbell Fly', 'dumbbell', 'isolation', ['chest'], ['front_delts']],
  ['Cable Fly', 'cable', 'isolation', ['chest'], ['front_delts']],
  ['Low-to-High Cable Fly', 'cable', 'isolation', ['chest'], ['front_delts']],
  ['Pec Deck', 'machine', 'isolation', ['chest'], []],
  // Shoulders
  ['Dumbbell Lateral Raise', 'dumbbell', 'isolation', ['side_delts'], []],
  ['Cable Lateral Raise', 'cable', 'isolation', ['side_delts'], []],
  ['Machine Lateral Raise', 'machine', 'isolation', ['side_delts'], []],
  ['Lean-Away Lateral Raise', 'dumbbell', 'isolation', ['side_delts'], []],
  ['Dumbbell Front Raise', 'dumbbell', 'isolation', ['front_delts'], []],
  ['Upright Row', 'barbell', 'isolation', ['side_delts'], ['upper_back', 'biceps']],
  ['Reverse Pec Deck', 'machine', 'isolation', ['rear_delts'], ['upper_back']],
  ['Rear Delt Dumbbell Fly', 'dumbbell', 'isolation', ['rear_delts'], ['upper_back']],
  ['Cable Rear Delt Fly', 'cable', 'isolation', ['rear_delts'], ['upper_back']],
  ['Face Pull', 'cable', 'isolation', ['rear_delts'], ['upper_back']],
  ['Band Pull-Apart', 'band', 'isolation', ['rear_delts'], ['upper_back']],
  // Back / traps
  ['Straight-Arm Pulldown', 'cable', 'isolation', ['lats'], []],
  ['Dumbbell Pullover', 'dumbbell', 'isolation', ['lats'], ['chest']],
  ['Barbell Shrug', 'barbell', 'isolation', ['upper_back'], ['forearms']],
  ['Dumbbell Shrug', 'dumbbell', 'isolation', ['upper_back'], ['forearms']],
  ['Back Extension', 'bodyweight', 'isolation', ['lower_back', 'glutes'], ['hamstrings']],
  ['Reverse Hyperextension', 'machine', 'isolation', ['glutes', 'lower_back'], ['hamstrings']],
  // Biceps
  ['Barbell Curl', 'barbell', 'isolation', ['biceps'], ['forearms']],
  ['EZ-Bar Curl', 'barbell', 'isolation', ['biceps'], ['forearms']],
  ['Dumbbell Curl', 'dumbbell', 'isolation', ['biceps'], ['forearms']],
  ['Hammer Curl', 'dumbbell', 'isolation', ['biceps', 'forearms'], []],
  ['Incline Dumbbell Curl', 'dumbbell', 'isolation', ['biceps'], []],
  ['Preacher Curl', 'machine', 'isolation', ['biceps'], []],
  ['Cable Curl', 'cable', 'isolation', ['biceps'], ['forearms']],
  ['Bayesian Cable Curl', 'cable', 'isolation', ['biceps'], []],
  ['Concentration Curl', 'dumbbell', 'isolation', ['biceps'], []],
  // Triceps
  ['Triceps Pushdown', 'cable', 'isolation', ['triceps'], []],
  ['Rope Pushdown', 'cable', 'isolation', ['triceps'], []],
  ['Overhead Cable Triceps Extension', 'cable', 'isolation', ['triceps'], []],
  ['Skull Crusher', 'barbell', 'isolation', ['triceps'], []],
  ['Overhead Dumbbell Triceps Extension', 'dumbbell', 'isolation', ['triceps'], []],
  ['Dumbbell Kickback', 'dumbbell', 'isolation', ['triceps'], []],
  ['Machine Triceps Extension', 'machine', 'isolation', ['triceps'], []],
  ['Bench Dip', 'bodyweight', 'isolation', ['triceps'], ['front_delts', 'chest']],
  // Forearms
  ['Wrist Curl', 'dumbbell', 'isolation', ['forearms'], []],
  ['Reverse Wrist Curl', 'dumbbell', 'isolation', ['forearms'], []],
  ['Reverse Curl', 'barbell', 'isolation', ['forearms', 'biceps'], []],
  ['Dead Hang', 'bodyweight', 'isolation', ['forearms'], ['lats']],
  // Legs
  ['Leg Extension', 'machine', 'isolation', ['quads'], []],
  ['Sissy Squat', 'bodyweight', 'isolation', ['quads'], []],
  ['Lying Leg Curl', 'machine', 'isolation', ['hamstrings'], ['calves']],
  ['Seated Leg Curl', 'machine', 'isolation', ['hamstrings'], []],
  ['Nordic Hamstring Curl', 'bodyweight', 'isolation', ['hamstrings'], []],
  ['Glute-Ham Raise', 'machine', 'isolation', ['hamstrings'], ['glutes']],
  ['Hip Adduction Machine', 'machine', 'isolation', ['adductors'], []],
  ['Copenhagen Plank', 'bodyweight', 'isolation', ['adductors'], ['obliques']],
  ['Hip Abduction Machine', 'machine', 'isolation', ['glutes'], []],
  ['Cable Kickback', 'cable', 'isolation', ['glutes'], ['hamstrings']],
  ['Standing Calf Raise', 'machine', 'isolation', ['calves'], []],
  ['Seated Calf Raise', 'machine', 'isolation', ['calves'], []],
  ['Leg Press Calf Raise', 'machine', 'isolation', ['calves'], []],
  ['Single-Leg Dumbbell Calf Raise', 'dumbbell', 'isolation', ['calves'], []],
]

const CORE: Row[] = [
  ['Plank', 'bodyweight', 'core', ['abs'], ['obliques']],
  ['Side Plank', 'bodyweight', 'core', ['obliques'], ['abs']],
  ['Hanging Leg Raise', 'bodyweight', 'core', ['abs'], ['obliques', 'forearms']],
  ['Hanging Knee Raise', 'bodyweight', 'core', ['abs'], ['obliques']],
  ['Cable Crunch', 'cable', 'core', ['abs'], []],
  ['Ab Wheel Rollout', 'other', 'core', ['abs'], ['lats', 'obliques']],
  ['Decline Sit-Up', 'bodyweight', 'core', ['abs'], []],
  ['Crunch', 'bodyweight', 'core', ['abs'], []],
  ['Machine Crunch', 'machine', 'core', ['abs'], []],
  ['Pallof Press', 'cable', 'core', ['obliques'], ['abs']],
  ['Cable Woodchop', 'cable', 'core', ['obliques'], ['abs']],
  ['Russian Twist', 'bodyweight', 'core', ['obliques'], ['abs']],
  ['Dead Bug', 'bodyweight', 'core', ['abs'], []],
  ['Bird Dog', 'bodyweight', 'core', ['lower_back'], ['glutes', 'abs']],
  ['Dragon Flag', 'bodyweight', 'core', ['abs'], ['obliques']],
]

/** Log type exceptions. Otherwise bodyweight kit → bodyweight × reps, else weight × reps. */
const LOG_TYPE_OVERRIDES: Record<string, LogType> = {
  // Timed holds
  Plank: 'duration',
  'Side Plank': 'duration',
  'Dead Hang': 'duration',
  'Copenhagen Plank': 'duration',
  // Loaded carries: weight for time
  "Farmer's Walk": 'weight_duration',
  'Suitcase Carry': 'weight_duration',
  'Trap Bar Carry': 'weight_duration',
  // Machine assistance (less = harder)
  'Assisted Pull-Up': 'assisted_reps',
  // Bodyweight movements that aren't listed with bodyweight equipment
  'Ab Wheel Rollout': 'bodyweight_reps',
  'Glute-Ham Raise': 'bodyweight_reps',
  'Band Pull-Apart': 'bodyweight_reps',
}

function logTypeFor(name: string, equipment: Equipment): LogType {
  return (
    LOG_TYPE_OVERRIDES[name] ?? (equipment === 'bodyweight' ? 'bodyweight_reps' : 'weight_reps')
  )
}

function build(rows: Row[], compound: boolean, restSeconds: number): ExerciseSeed[] {
  return rows.map(([name, equipment, pattern, primary, secondary]) => ({
    name,
    equipment,
    pattern,
    compound,
    restSeconds,
    logType: logTypeFor(name, equipment),
    primary,
    secondary,
  }))
}

/** Renamed exercises keep the ID of their original name so logged history stays linked. */
const ID_NAMES: Record<string, string> = {
  "Farmer's Walk": "Farmer's Carry",
}

export const EXERCISES: readonly ExerciseSeed[] = [
  ...build(COMPOUND, true, 180),
  ...build(MULTI, true, 120),
  ...build(ISOLATION, false, 90),
  ...build(CORE, false, 60),
].map((e) => (ID_NAMES[e.name] ? { ...e, idName: ID_NAMES[e.name] } : e))
