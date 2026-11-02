/** Set ranges, muscle groupings and exercise suggestions used by the rating. */

/*
 * Sources:
 * - Weekly sets drive growth most (Schoenfeld 2017; Pelland 2024).
 * - Extra sets for one muscle in one session add less and less (Pelland 2024).
 * - Muscles take ~48–72 h to recover from hard training (MacDougall 1995; Damas 2015).
 */

/** A session the day after another for the same muscle counts as this much. */
export const BACK_TO_BACK_CREDIT = 0.5

/** Sets per muscle per session before extra sets count half. */
export const PER_SESSION_MAX = 12

/** Used to split workouts into a push day and a pull day. */
export const PUSH_MUSCLES: readonly string[] = ['chest', 'front_delts', 'side_delts', 'triceps']
export const PULL_MUSCLES: readonly string[] = [
  'lats',
  'upper_back',
  'rear_delts',
  'biceps',
  'forearms',
]

/** Default weekly set ranges. A min of 0 means optional. */
export const DEFAULT_RANGES: Readonly<Record<string, readonly [number, number]>> = {
  chest: [10, 20],
  front_delts: [4, 12],
  side_delts: [10, 20],
  rear_delts: [8, 16],
  lats: [10, 20],
  upper_back: [8, 20],
  lower_back: [0, 10],
  biceps: [8, 18],
  triceps: [8, 18],
  forearms: [0, 12],
  abs: [4, 14],
  obliques: [0, 10],
  glutes: [8, 16],
  quads: [10, 20],
  hamstrings: [8, 16],
  adductors: [0, 10],
  calves: [6, 14],
}

/** The generic range every muscle target starts with. */
export const GENERIC_RANGE = [10, 20] as const

/** Muscles usually trained together; used to pick which workout a new exercise goes in. */
export const FAMILY: Readonly<Record<string, readonly string[]>> = {
  chest: ['chest', 'front_delts', 'triceps', 'side_delts'],
  front_delts: ['chest', 'front_delts', 'triceps', 'side_delts'],
  side_delts: ['side_delts', 'front_delts', 'chest', 'triceps', 'rear_delts'],
  triceps: ['triceps', 'chest', 'front_delts', 'side_delts'],
  rear_delts: ['rear_delts', 'upper_back', 'lats', 'biceps'],
  lats: ['lats', 'upper_back', 'rear_delts', 'biceps'],
  upper_back: ['upper_back', 'lats', 'rear_delts', 'biceps'],
  biceps: ['biceps', 'lats', 'upper_back', 'forearms'],
  forearms: ['forearms', 'biceps', 'lats', 'upper_back'],
  lower_back: ['lower_back', 'hamstrings', 'glutes', 'upper_back'],
  abs: ['abs', 'obliques'],
  obliques: ['obliques', 'abs'],
  glutes: ['glutes', 'hamstrings', 'quads'],
  quads: ['quads', 'glutes', 'adductors'],
  hamstrings: ['hamstrings', 'glutes', 'lower_back'],
  adductors: ['adductors', 'quads', 'glutes'],
  calves: ['calves', 'quads', 'hamstrings'],
}

/** What to add when a muscle is short, best first. */
export const SUGGEST_FOR_MUSCLE: Readonly<Record<string, readonly string[]>> = {
  chest: ['Incline Dumbbell Press', 'Machine Chest Press', 'Cable Fly'],
  front_delts: ['Seated Dumbbell Shoulder Press', 'Arnold Press'],
  side_delts: ['Cable Lateral Raise', 'Dumbbell Lateral Raise', 'Machine Lateral Raise'],
  rear_delts: ['Reverse Pec Deck', 'Face Pull', 'Cable Rear Delt Fly'],
  lats: ['Lat Pulldown', 'Single-Arm Cable Pulldown', 'Straight-Arm Pulldown'],
  upper_back: ['Chest-Supported Dumbbell Row', 'Seated Cable Row', 'Dumbbell Shrug'],
  lower_back: ['Back Extension'],
  biceps: ['Incline Dumbbell Curl', 'Bayesian Cable Curl', 'Hammer Curl'],
  triceps: ['Overhead Cable Triceps Extension', 'Triceps Pushdown', 'Skull Crusher'],
  forearms: ['Hammer Curl', 'Wrist Curl'],
  abs: ['Cable Crunch', 'Hanging Knee Raise', 'Ab Wheel Rollout'],
  obliques: ['Pallof Press', 'Cable Woodchop'],
  glutes: ['Barbell Hip Thrust', 'Machine Hip Thrust'],
  quads: ['Leg Press', 'Hack Squat', 'Leg Extension'],
  hamstrings: ['Seated Leg Curl', 'Lying Leg Curl', 'Romanian Deadlift'],
  adductors: ['Hip Adduction Machine'],
  calves: ['Standing Calf Raise', 'Seated Calf Raise'],
}

export interface PatternRule {
  pattern: string
  label: string
  /** Only expected when at least one of these muscles is being trained (not paused) */
  needs: readonly string[]
  /** How much it counts towards the coverage score */
  weight: number
  /** Muscle whose family decides which workout gets the suggestion */
  home: string
  suggest: readonly string[]
}

export const PATTERNS: readonly PatternRule[] = [
  {
    pattern: 'horizontal_push',
    label: 'horizontal press (e.g. bench press)',
    needs: ['chest'],
    weight: 1,
    home: 'chest',
    suggest: ['Machine Chest Press', 'Dumbbell Bench Press'],
  },
  {
    pattern: 'vertical_push',
    label: 'overhead press',
    needs: ['front_delts', 'side_delts'],
    weight: 1,
    home: 'front_delts',
    suggest: ['Seated Dumbbell Shoulder Press', 'Arnold Press'],
  },
  {
    pattern: 'horizontal_pull',
    label: 'row',
    needs: ['upper_back', 'lats'],
    weight: 1,
    home: 'upper_back',
    suggest: ['Chest-Supported Dumbbell Row', 'Seated Cable Row'],
  },
  {
    pattern: 'vertical_pull',
    label: 'pulldown or pull-up',
    needs: ['lats'],
    weight: 1,
    home: 'lats',
    suggest: ['Lat Pulldown', 'Pull-Up'],
  },
  {
    pattern: 'squat',
    label: 'squat',
    needs: ['quads'],
    weight: 1,
    home: 'quads',
    suggest: ['Leg Press', 'Hack Squat'],
  },
  {
    pattern: 'hinge',
    label: 'hip hinge (e.g. Romanian deadlift)',
    needs: ['hamstrings', 'glutes'],
    weight: 1,
    home: 'hamstrings',
    suggest: ['Romanian Deadlift', 'Dumbbell Romanian Deadlift'],
  },
  {
    pattern: 'lunge',
    label: 'single-leg work (e.g. lunges)',
    needs: ['quads', 'glutes'],
    weight: 0.5,
    home: 'quads',
    suggest: ['Bulgarian Split Squat', 'Dumbbell Walking Lunge'],
  },
  {
    pattern: 'core',
    label: 'core work',
    needs: ['abs'],
    weight: 0.5,
    home: 'abs',
    suggest: ['Cable Crunch', 'Hanging Knee Raise'],
  },
  {
    pattern: 'carry',
    label: 'loaded carry',
    needs: ['forearms', 'obliques'],
    weight: 0.25,
    home: 'forearms',
    suggest: ["Farmer's Walk", 'Suitcase Carry'],
  },
]
