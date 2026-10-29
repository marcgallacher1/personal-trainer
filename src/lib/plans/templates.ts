/**
 * Plan presets. A plan is one type of workout (Push, Pull, Legs…) with versions A, B…
 * Every preset is copied into a normal, fully editable plan.
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
  /** Version name within the plan: 'A', 'B'… */
  name: string
  emoji: string
  description: string
  exercises: TemplateExercise[]
  /** ISO weekdays this version is scheduled on (optional) */
  weekdays?: number[]
}

export interface PlanTemplate {
  id: string
  name: string
  description: string
  scheduleMode: 'rotation' | 'weekday'
  /** Shown first, labelled as suited to the user's upper-body focus */
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
): TemplateExercise => ({ name, sets, min, max, rir, ...extra })
const I = (
  name: string,
  sets = 3,
  min = 10,
  max = 15,
  rir = 0,
  extra: Partial<TemplateExercise> = {},
): TemplateExercise => ({ name, sets, min, max, rir, ...extra })

export const TEMPLATES: readonly PlanTemplate[] = [
  {
    id: 'push',
    name: 'Push',
    description: 'Chest, shoulders and triceps, with rear delts worked in.',
    scheduleMode: 'weekday',
    suggested: true,
    sessions: [
      {
        name: 'A',
        emoji: '💪',
        description:
          'Chest, shoulders & triceps. Incline-led pressing, plenty of side and rear delt work.',
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
        name: 'B',
        emoji: '🔥',
        description:
          'Chest & shoulders. Heavier flat bench, flyes, and extra lateral raise volume.',
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
    ],
  },
  {
    id: 'pull',
    name: 'Pull',
    description: 'Back and biceps, with traps and rear delts worked in.',
    scheduleMode: 'weekday',
    suggested: true,
    sessions: [
      {
        name: 'A',
        emoji: '🦍',
        description:
          'Back & biceps. Width from pulldowns, thickness from rows, plus shrugs for traps.',
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
        name: 'B',
        emoji: '⚡',
        description: 'Back & arms. Pull-ups and heavy rows, then a curl and pushdown superset.',
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
    id: 'shoulders-arms',
    name: 'Shoulders & arms',
    description: 'Delts from every angle, then biceps and triceps supersets.',
    scheduleMode: 'weekday',
    suggested: true,
    sessions: [
      {
        name: 'A',
        emoji: '🎯',
        description: 'Overhead press, lots of lateral and rear delt work, then arm supersets.',
        exercises: [
          C('Seated Dumbbell Shoulder Press', 3, 8, 12, 1, {
            alternatives: ['Machine Shoulder Press', 'Overhead Press'],
          }),
          I('Cable Lateral Raise', 4, 12, 15, 0, { alternatives: ['Dumbbell Lateral Raise'] }),
          I('Reverse Pec Deck', 3, 12, 15, 0, { alternatives: ['Face Pull'] }),
          I('EZ-Bar Curl', 3, 8, 12, 0, { superset: 'arms1' }),
          I('Skull Crusher', 3, 8, 12, 0, { superset: 'arms1' }),
          I('Incline Dumbbell Curl', 2, 10, 12, 0, { superset: 'arms2' }),
          I('Overhead Cable Triceps Extension', 2, 10, 15, 0, { superset: 'arms2' }),
          I('Hammer Curl', 2, 10, 12, 0),
        ],
      },
    ],
  },
  {
    id: 'back-arms',
    name: 'Back & arms',
    description: 'Back width and thickness, then biceps and triceps.',
    scheduleMode: 'weekday',
    suggested: true,
    sessions: [
      {
        name: 'A',
        emoji: '🦾',
        description: 'Pulldowns and rows for the back, then curl and pushdown supersets.',
        exercises: [
          C('Lat Pulldown', 3, 8, 12, 1, { alternatives: ['Pull-Up'] }),
          C('Chest-Supported Dumbbell Row', 3, 8, 12, 1, { alternatives: ['Machine Row'] }),
          I('Straight-Arm Pulldown', 2, 12, 15, 0),
          I('Face Pull', 2, 12, 15, 0),
          I('Barbell Curl', 3, 8, 12, 0, { superset: 'arms1', alternatives: ['EZ-Bar Curl'] }),
          I('Rope Pushdown', 3, 10, 15, 0, { superset: 'arms1' }),
          I('Bayesian Cable Curl', 2, 10, 15, 0, { superset: 'arms2' }),
          I('Overhead Dumbbell Triceps Extension', 2, 10, 15, 0, { superset: 'arms2' }),
        ],
      },
    ],
  },
  {
    id: 'chest-back',
    name: 'Chest & back',
    description: 'Antagonist pairing: push and pull for the torso in one session.',
    scheduleMode: 'weekday',
    sessions: [
      {
        name: 'A',
        emoji: '🏛️',
        description:
          'Bench and pull-ups, incline and rows, finished with a fly / pulldown superset.',
        exercises: [
          C('Barbell Bench Press', 3, 6, 10),
          C('Pull-Up', 3, 6, 10),
          C('Incline Dumbbell Press', 3, 8, 12),
          C('Barbell Row', 3, 8, 10),
          I('Cable Fly', 3, 12, 15, 0, { superset: 'cb' }),
          I('Straight-Arm Pulldown', 3, 12, 15, 0, { superset: 'cb' }),
        ],
      },
    ],
  },
  {
    id: 'legs',
    name: 'Legs',
    description: 'Quads, hamstrings, glutes and calves.',
    scheduleMode: 'weekday',
    sessions: [
      {
        name: 'A',
        emoji: '🦵',
        description: 'Squat-focused: quads first, then hamstrings and calves.',
        exercises: [
          C('Back Squat', 3, 6, 10),
          C('Romanian Deadlift', 3, 8, 10),
          C('Leg Press', 2, 10, 12),
          I('Lying Leg Curl', 3, 10, 15),
          I('Standing Calf Raise', 3, 10, 15),
        ],
      },
      {
        name: 'B',
        emoji: '🍑',
        description: 'Hinge-focused: deadlifts, split squats and glutes.',
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
    id: 'upper',
    name: 'Upper',
    description: 'All upper-body muscles in one session.',
    scheduleMode: 'weekday',
    sessions: [
      {
        name: 'A',
        emoji: '💪',
        description: 'Heavier: bench, rows, shoulder press and pulldowns, plus arms.',
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
        name: 'B',
        emoji: '🔥',
        description: 'Lighter: incline, pull-ups, machines and more isolation.',
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
    ],
  },
  {
    id: 'full-body',
    name: 'Full body',
    description: 'Every muscle in one session. Great for busy weeks.',
    scheduleMode: 'weekday',
    sessions: [
      {
        name: 'A',
        emoji: '🅰️',
        description: 'Squat, bench, row, RDL, laterals and abs.',
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
        name: 'B',
        emoji: '🅱️',
        description: 'Leg press, overhead press, pulldowns, leg curls and arms.',
        exercises: [
          C('Leg Press', 3, 10, 12),
          C('Overhead Press', 3, 6, 10),
          C('Lat Pulldown', 3, 8, 12),
          I('Lying Leg Curl', 3, 10, 15),
          I('Dumbbell Curl', 2, 10, 12),
          I('Triceps Pushdown', 2, 10, 15),
        ],
      },
    ],
  },
]

/** Next unused version letter for a plan: A, B, C… */
export function nextVersionName(existing: readonly string[]): string {
  const used = new Set(existing.map((n) => n.trim().toUpperCase()))
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i)
    if (!used.has(letter)) return letter
  }
  return `${existing.length + 1}`
}

/** "Push" + "A" → "Push A" */
export function versionTitle(planName: string, versionName: string): string {
  return `${planName} ${versionName}`.trim()
}

export interface SplitGroup {
  category: string
  sessions: { id: string; version: string }[]
}

/**
 * Splits a plan whose sessions are named like "Push A", "Pull A", "Push B" into one group per
 * workout type, keeping the trailing letter as the version. Names without a letter become version A.
 */
export function splitByCategory(
  sessions: readonly { id: string; name: string; order: number }[],
): SplitGroup[] {
  const groups = new Map<string, SplitGroup>()
  for (const s of sessions.toSorted((a, b) => a.order - b.order)) {
    const m = /^(.*\S)\s+([A-Z])$/.exec(s.name.trim())
    const category = m ? m[1]! : s.name.trim()
    const group = groups.get(category) ?? { category, sessions: [] }
    const version = m ? m[2]! : nextVersionName(group.sessions.map((x) => x.version))
    group.sessions.push({ id: s.id, version })
    groups.set(category, group)
  }
  return [...groups.values()]
}
