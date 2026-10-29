/**
 * Starting-point plans. Every one is copied into a normal, fully editable plan.
 * Exercise names must match the seeded catalogue (checked by tests).
 *
 * Rep defaults for muscle growth: compounds 6–10 / 8–12 at RIR 1, isolations 10–15 to failure.
 */

export interface TemplateExercise {
  name: string
  sets: number
  min: number
  max: number
  /** Target reps in reserve; 0 = to failure */
  rir: number
  /** Exercises sharing a key are performed as a superset */
  superset?: string
  /** Swap options when equipment is taken */
  alternatives?: string[]
}

export interface TemplateSession {
  name: string
  emoji: string
  exercises: TemplateExercise[]
  /** Weekday-mode templates: ISO weekdays this session falls on */
  weekdays?: number[]
}

export interface PlanTemplate {
  id: string
  name: string
  description: string
  scheduleMode: 'rotation' | 'weekday'
  /** Shown first and labelled as suggested for the user */
  suggested?: boolean
  sessions: TemplateSession[]
}

const C = (
  name: string,
  sets = 3,
  min = 8,
  max = 12,
  rir = 1,
  extra: Partial<TemplateExercise> = {},
) => ({
  name,
  sets,
  min,
  max,
  rir,
  ...extra,
})
const I = (
  name: string,
  sets = 3,
  min = 10,
  max = 15,
  rir = 0,
  extra: Partial<TemplateExercise> = {},
) => ({
  name,
  sets,
  min,
  max,
  rir,
  ...extra,
})

export const TEMPLATES: readonly PlanTemplate[] = [
  {
    id: 'upper-focus-4',
    name: 'Upper focus · 4 days',
    description:
      'Push / Pull twice a week on any days. No leg days. Rear delts and traps worked into both. Built for bringing up a lagging upper body.',
    scheduleMode: 'rotation',
    suggested: true,
    sessions: [
      {
        name: 'Push A',
        emoji: '💪',
        exercises: [
          C('Incline Dumbbell Press', 3, 8, 12, 1, {
            alternatives: ['Incline Machine Press', 'Smith Machine Incline Press'],
          }),
          C('Machine Chest Press', 3, 8, 12, 1, {
            alternatives: ['Dumbbell Bench Press', 'Barbell Bench Press'],
          }),
          C('Seated Dumbbell Shoulder Press', 3, 8, 12, 1, {
            alternatives: ['Machine Shoulder Press'],
          }),
          I('Cable Lateral Raise', 3, 12, 15, 0, {
            alternatives: ['Dumbbell Lateral Raise', 'Machine Lateral Raise'],
          }),
          I('Reverse Pec Deck', 3, 12, 15, 0, {
            alternatives: ['Cable Rear Delt Fly', 'Rear Delt Dumbbell Fly'],
          }),
          I('Overhead Cable Triceps Extension', 3, 10, 15, 0, { superset: 'tri' }),
          I('Triceps Pushdown', 2, 10, 15, 0, { superset: 'tri', alternatives: ['Rope Pushdown'] }),
        ],
      },
      {
        name: 'Pull A',
        emoji: '🦍',
        exercises: [
          C('Lat Pulldown', 3, 8, 12, 1, { alternatives: ['Pull-Up', 'Machine Pulldown'] }),
          C('Chest-Supported Dumbbell Row', 3, 8, 12, 1, {
            alternatives: ['Machine Row', 'Seal Row'],
          }),
          C('Seated Cable Row', 2, 10, 12, 1),
          I('Face Pull', 3, 12, 15, 0),
          I('Dumbbell Shrug', 3, 10, 15, 0, { alternatives: ['Barbell Shrug'] }),
          I('Incline Dumbbell Curl', 3, 10, 12, 0, { alternatives: ['Bayesian Cable Curl'] }),
          I('Hammer Curl', 2, 10, 12, 0),
        ],
      },
      {
        name: 'Push B',
        emoji: '🔥',
        exercises: [
          C('Barbell Bench Press', 3, 6, 10, 1, {
            alternatives: ['Dumbbell Bench Press', 'Machine Chest Press'],
          }),
          I('Low-to-High Cable Fly', 3, 10, 15, 0, {
            alternatives: ['Incline Dumbbell Fly', 'Pec Deck'],
          }),
          C('Machine Shoulder Press', 3, 8, 12, 1, {
            alternatives: ['Seated Dumbbell Shoulder Press'],
          }),
          I('Dumbbell Lateral Raise', 4, 12, 20, 0, { alternatives: ['Cable Lateral Raise'] }),
          I('Rear Delt Dumbbell Fly', 3, 12, 15, 0, { alternatives: ['Reverse Pec Deck'] }),
          I('Skull Crusher', 3, 8, 12, 0, {
            alternatives: ['Overhead Dumbbell Triceps Extension'],
          }),
        ],
      },
      {
        name: 'Pull B',
        emoji: '⚡',
        exercises: [
          C('Pull-Up', 3, 6, 10, 1, { alternatives: ['Assisted Pull-Up', 'Lat Pulldown'] }),
          C('T-Bar Row', 3, 8, 10, 1, { alternatives: ['Barbell Row', 'Machine Row'] }),
          C('Single-Arm Cable Pulldown', 2, 10, 12, 1),
          I('Cable Rear Delt Fly', 2, 12, 15, 0),
          I('EZ-Bar Curl', 3, 8, 12, 0, {
            superset: 'arms',
            alternatives: ['Barbell Curl', 'Cable Curl'],
          }),
          I('Rope Pushdown', 3, 10, 15, 0, { superset: 'arms' }),
          I('Bayesian Cable Curl', 2, 10, 15, 0),
        ],
      },
    ],
  },
  {
    id: 'full-body-3',
    name: 'Full body · 3 days',
    description:
      'Mon / Wed / Fri, every muscle three times a week. Great for beginners or busy weeks.',
    scheduleMode: 'weekday',
    sessions: [
      {
        name: 'Full body A',
        emoji: '🅰️',
        weekdays: [1],
        exercises: [
          C('Back Squat', 3, 6, 10),
          C('Barbell Bench Press', 3, 6, 10),
          C('Barbell Row', 3, 8, 10),
          C('Romanian Deadlift', 2, 8, 10),
          I('Dumbbell Lateral Raise', 3, 12, 15),
          I('Cable Crunch', 2, 10, 15),
        ],
      },
      {
        name: 'Full body B',
        emoji: '🅱️',
        weekdays: [3],
        exercises: [
          C('Leg Press', 3, 10, 12),
          C('Overhead Press', 3, 6, 10),
          C('Lat Pulldown', 3, 8, 12),
          I('Lying Leg Curl', 3, 10, 15),
          I('Dumbbell Curl', 2, 10, 12),
          I('Triceps Pushdown', 2, 10, 15),
        ],
      },
      {
        name: 'Full body C',
        emoji: '🇨',
        weekdays: [5],
        exercises: [
          C('Deadlift', 3, 5, 8),
          C('Incline Dumbbell Press', 3, 8, 12),
          C('Seated Cable Row', 3, 8, 12),
          C('Bulgarian Split Squat', 2, 8, 12),
          I('Face Pull', 3, 12, 15),
          I('Standing Calf Raise', 3, 10, 15),
        ],
      },
    ],
  },
  {
    id: 'upper-lower-4',
    name: 'Upper / Lower · 4 days',
    description: 'Mon / Tue / Thu / Fri. Each muscle twice a week with plenty of recovery.',
    scheduleMode: 'weekday',
    sessions: [
      {
        name: 'Upper A',
        emoji: '💪',
        weekdays: [1],
        exercises: [
          C('Barbell Bench Press', 3, 6, 10),
          C('Barbell Row', 3, 8, 10),
          C('Seated Dumbbell Shoulder Press', 3, 8, 12),
          C('Lat Pulldown', 3, 8, 12),
          I('Dumbbell Lateral Raise', 3, 12, 15),
          I('EZ-Bar Curl', 2, 10, 12),
          I('Triceps Pushdown', 2, 10, 15),
        ],
      },
      {
        name: 'Lower A',
        emoji: '🦵',
        weekdays: [2],
        exercises: [
          C('Back Squat', 3, 6, 10),
          C('Romanian Deadlift', 3, 8, 10),
          C('Leg Press', 2, 10, 12),
          I('Lying Leg Curl', 3, 10, 15),
          I('Standing Calf Raise', 3, 10, 15),
          I('Hanging Leg Raise', 3, 10, 15),
        ],
      },
      {
        name: 'Upper B',
        emoji: '🔥',
        weekdays: [4],
        exercises: [
          C('Incline Dumbbell Press', 3, 8, 12),
          C('Pull-Up', 3, 6, 10),
          C('Machine Shoulder Press', 3, 8, 12),
          C('Chest-Supported Dumbbell Row', 3, 8, 12),
          I('Cable Fly', 2, 12, 15),
          I('Reverse Pec Deck', 3, 12, 15),
          I('Hammer Curl', 2, 10, 12),
          I('Overhead Cable Triceps Extension', 2, 10, 15),
        ],
      },
      {
        name: 'Lower B',
        emoji: '🍑',
        weekdays: [5],
        exercises: [
          C('Deadlift', 3, 5, 8),
          C('Bulgarian Split Squat', 3, 8, 12),
          C('Barbell Hip Thrust', 3, 8, 12),
          I('Leg Extension', 3, 12, 15),
          I('Seated Leg Curl', 3, 10, 15),
          I('Seated Calf Raise', 3, 12, 15),
        ],
      },
    ],
  },
  {
    id: 'ppl-6',
    name: 'Push / Pull / Legs · 6 days',
    description: 'Mon–Sat, each session twice a week. High volume for experienced lifters.',
    scheduleMode: 'weekday',
    sessions: [
      {
        name: 'Push',
        emoji: '💪',
        weekdays: [1, 4],
        exercises: [
          C('Barbell Bench Press', 3, 6, 10),
          C('Incline Dumbbell Press', 3, 8, 12),
          C('Seated Dumbbell Shoulder Press', 3, 8, 12),
          I('Cable Lateral Raise', 3, 12, 15),
          I('Overhead Cable Triceps Extension', 3, 10, 15),
          I('Triceps Pushdown', 2, 10, 15),
        ],
      },
      {
        name: 'Pull',
        emoji: '🦍',
        weekdays: [2, 5],
        exercises: [
          C('Pull-Up', 3, 6, 10),
          C('Barbell Row', 3, 8, 10),
          C('Seated Cable Row', 3, 10, 12),
          I('Face Pull', 3, 12, 15),
          I('Dumbbell Shrug', 3, 10, 15),
          I('Incline Dumbbell Curl', 3, 10, 12),
          I('Hammer Curl', 2, 10, 12),
        ],
      },
      {
        name: 'Legs',
        emoji: '🦵',
        weekdays: [3, 6],
        exercises: [
          C('Back Squat', 3, 6, 10),
          C('Romanian Deadlift', 3, 8, 10),
          C('Leg Press', 3, 10, 12),
          I('Lying Leg Curl', 3, 10, 15),
          I('Leg Extension', 2, 12, 15),
          I('Standing Calf Raise', 4, 10, 15),
        ],
      },
    ],
  },
  {
    id: 'arnold-6',
    name: 'Arnold split · 6 days',
    description:
      'Chest & back, shoulders & arms, legs — each twice a week. Lots of upper-body volume.',
    scheduleMode: 'weekday',
    sessions: [
      {
        name: 'Chest & back',
        emoji: '🏛️',
        weekdays: [1, 4],
        exercises: [
          C('Barbell Bench Press', 3, 6, 10),
          C('Pull-Up', 3, 6, 10),
          C('Incline Dumbbell Press', 3, 8, 12),
          C('Barbell Row', 3, 8, 10),
          I('Cable Fly', 3, 12, 15, 0, { superset: 'cb' }),
          I('Straight-Arm Pulldown', 3, 12, 15, 0, { superset: 'cb' }),
        ],
      },
      {
        name: 'Shoulders & arms',
        emoji: '💪',
        weekdays: [2, 5],
        exercises: [
          C('Overhead Press', 3, 6, 10),
          I('Dumbbell Lateral Raise', 4, 12, 15),
          I('Reverse Pec Deck', 3, 12, 15),
          I('Barbell Curl', 3, 8, 12, 0, { superset: 'arms1' }),
          I('Skull Crusher', 3, 8, 12, 0, { superset: 'arms1' }),
          I('Incline Dumbbell Curl', 2, 10, 12, 0, { superset: 'arms2' }),
          I('Overhead Cable Triceps Extension', 2, 10, 15, 0, { superset: 'arms2' }),
        ],
      },
      {
        name: 'Legs',
        emoji: '🦵',
        weekdays: [3, 6],
        exercises: [
          C('Back Squat', 3, 6, 10),
          C('Romanian Deadlift', 3, 8, 10),
          C('Dumbbell Walking Lunge', 2, 10, 12),
          I('Leg Extension', 3, 12, 15),
          I('Lying Leg Curl', 3, 10, 15),
          I('Standing Calf Raise', 4, 10, 15),
        ],
      },
    ],
  },
]
