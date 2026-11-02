import { describe, expect, it } from 'vitest'
import type { ExerciseInfo, TrainingSession } from '../analysis/training'
import { addDays } from '../analysis/training'
import { ratePlan, type MuscleGoal, type RatingWorkout } from '../rating/rate'
import { EXERCISES } from '../seed/exercises'
import { MUSCLES } from '../seed/muscles'
import { describeTarget, todaysTarget, type LastSet, type TargetInput } from './progression'
import { buildProposals, type ProposalInput } from './proposals'

const info: Map<string, ExerciseInfo> = new Map(
  EXERCISES.map((e) => [
    e.name,
    {
      id: e.name,
      name: e.name,
      pattern: e.pattern,
      isCompound: e.compound,
      logType: e.logType,
      restSeconds: e.restSeconds,
      muscles: [
        ...e.primary.map((muscleId) => ({ muscleId, weight: 1 })),
        ...e.secondary.map((muscleId) => ({ muscleId, weight: 0.5 })),
      ],
    },
  ]),
)

const sets = (n: number, weightKg: number, reps: number | number[], rir: number | null = 2) =>
  Array.from({ length: n }, (_, i): LastSet => ({
    weightKg,
    reps: Array.isArray(reps) ? reps[i]! : reps,
    rir,
    setType: 'working',
  }))

const target = (over: Partial<TargetInput>): TargetInput => ({
  last: sets(3, 60, 8),
  repsMin: 8,
  repsMax: 12,
  targetRir: 2,
  isCompound: true,
  logType: 'weight_reps',
  ...over,
})

describe("today's target", () => {
  it('adds a rep until every set hits the top of the range', () => {
    const t = todaysTarget(target({ last: sets(3, 60, [10, 9, 8]) }))
    expect(t).toMatchObject({ weightKg: 60, reps: 9, heavier: false })
    expect(describeTarget(t!)).toBe('60 kg × 9')
  })

  it('adds 2.5 kg to a compound once every set hits the top, back to the bottom of the range', () => {
    expect(todaysTarget(target({ last: sets(3, 60, 12) }))).toMatchObject({
      weightKg: 62.5,
      reps: 8,
      heavier: true,
    })
  })

  it('adds 1 kg to an isolation', () => {
    expect(todaysTarget(target({ isCompound: false, last: sets(3, 10, 12) }))?.weightKg).toBe(11)
  })

  it('repeats the weight if the top was hit but far harder than planned', () => {
    expect(todaysTarget(target({ last: sets(3, 60, 12, 0) }))).toMatchObject({
      weightKg: 60,
      reps: 12,
      heavier: false,
    })
  })

  it('ignores warm-ups and uses the heaviest working weight', () => {
    const last = [
      { weightKg: 30, reps: 10, rir: null, setType: 'warmup' },
      ...sets(2, 60, 12),
      ...sets(1, 55, 12),
    ]
    expect(todaysTarget(target({ last }))?.weightKg).toBe(62.5)
  })

  it('takes less help on assisted moves', () => {
    expect(
      todaysTarget(target({ logType: 'assisted_reps', last: sets(3, 30, 12) }))?.weightKg,
    ).toBe(27.5)
  })

  it('adds reps on bodyweight moves', () => {
    expect(
      todaysTarget(target({ logType: 'bodyweight_reps', last: sets(3, 0, [10, 9, 9]) })),
    ).toMatchObject({ weightKg: null, reps: 10 })
  })

  it('uses an accepted reset weight', () => {
    expect(todaysTarget(target({ resetKg: 72.5 }))).toMatchObject({ weightKg: 72.5, reps: 8 })
  })

  it('has nothing to say without history, a rep range, or for timed holds', () => {
    expect(todaysTarget(target({ last: null }))).toBeNull()
    expect(todaysTarget(target({ repsMin: null, repsMax: null }))).toBeNull()
    expect(todaysTarget(target({ logType: 'duration' }))).toBeNull()
  })
})

// --- Proposals ---

const goals = (over: Partial<Record<string, Partial<MuscleGoal>>> = {}): MuscleGoal[] =>
  MUSCLES.map((m) => ({
    id: m.id,
    name: m.name,
    min: 0,
    max: 30,
    priority: false,
    paused: false,
    ...over[m.id],
  }))

const target8to12 = Array.from({ length: 3 }, () => ({
  set_type: 'working',
  reps_min: 8,
  reps_max: 12,
  seconds_min: null,
  seconds_max: null,
  target_rir: 2,
}))

const workout = (id: string, days: number[], exercises: string[]): RatingWorkout => ({
  id,
  name: id,
  timesPerWeek: days.length,
  days,
  exercises: exercises.map((exerciseId, i) => ({
    id: `${id}-${i}`,
    exerciseId,
    sets: target8to12,
  })),
})

const PUSH = workout('Push', [1], ['Barbell Bench Press', 'Cable Lateral Raise'])
const PULL = workout('Pull', [2], ['Lat Pulldown', 'Barbell Row'])
const LEGS = workout('Legs', [4], ['Barbell Back Squat', 'Romanian Deadlift', 'Leg Extension'])

function logged(id: string, date: string, items: [string, number, number][], plan?: string) {
  return {
    id,
    date,
    startedAt: `${date}T18:00:00.000Z`,
    endedAt: `${date}T19:00:00.000Z`,
    name: id,
    planId: null,
    planSessionId: plan ?? null,
    sets: items.flatMap(([exerciseId, n, weightKg]) =>
      Array.from({ length: n }, () => ({
        exerciseId,
        weightKg,
        reps: 8,
        seconds: null,
        setType: 'working',
        rir: 2,
      })),
    ),
  } satisfies TrainingSession
}

// 2026-11-02 is a Monday
const MON = '2026-11-02'

function proposalInput(over: Partial<ProposalInput> = {}, muscles = goals()): ProposalInput {
  const workouts = [PUSH, PULL, LEGS]
  return {
    today: addDays(MON, 4), // Friday
    sessions: [],
    ctx: { exercises: info, muscles, focus: 'hypertrophy' },
    plan: {
      id: 'plan',
      workouts,
      since: '2026-01-01',
      rating: ratePlan({ mode: 'plan', workouts, exercises: info, muscles, focus: 'hypertrophy' }),
    },
    decided: new Set(),
    ...over,
  }
}

const pushDone = logged('a', MON, [['Barbell Bench Press', 3, 60]], 'Push')
const pullDone = logged('b', addDays(MON, 1), [['Lat Pulldown', 3, 50]], 'Pull')

describe('missed workouts', () => {
  it('offers to move it to the next free day or fold its key lifts into the next workout', () => {
    // Fri: Legs (Thu) was missed; Sat and Sun are free; no workout left this week
    const [p, ...rest] = buildProposals(proposalInput({ sessions: [pushDone, pullDone] }))
    expect(rest).toEqual([])
    expect(p).toMatchObject({ key: `missed:Legs:${addDays(MON, 3)}`, title: 'You missed Legs' })
    expect(p!.options.map((o) => o.label)).toEqual(['Do it today'])
  })

  it('suggests a later day if you’ve already trained today, and folds into the next workout', () => {
    // Wed: Push (Mon) missed; Pull done Tue; trained Wed already
    const sessions = [pullDone, logged('c', addDays(MON, 2), [['Leg Press', 3, 100]])]
    const [p] = buildProposals(proposalInput({ today: addDays(MON, 2), sessions }))
    expect(p?.title).toBe('You missed Push')
    expect(p!.options).toEqual([
      expect.objectContaining({
        label: 'Move to Fri',
        action: expect.objectContaining({ date: addDays(MON, 4) }),
      }),
      expect.objectContaining({
        // Key lifts = the compounds
        label: 'Add Barbell Bench Press to Legs',
        action: {
          kind: 'fold',
          workoutId: 'Push',
          intoWorkoutId: 'Legs',
          date: addDays(MON, 3),
          exerciseIds: ['Barbell Bench Press'],
        },
      }),
    ])
  })

  it('stays quiet when everything so far is done, on Mondays, and once decided', () => {
    const done = [
      pushDone,
      pullDone,
      logged('c', addDays(MON, 3), [['Barbell Back Squat', 3, 100]], 'Legs'),
    ]
    expect(buildProposals(proposalInput({ sessions: done }))).toEqual([])
    expect(buildProposals(proposalInput({ today: MON }))).toEqual([])
    const key = `missed:Legs:${addDays(MON, 3)}`
    expect(
      buildProposals(proposalInput({ sessions: [pushDone, pullDone], decided: new Set([key]) })),
    ).toEqual([])
  })

  it('ignores days before the plan started', () => {
    expect(
      buildProposals(
        proposalInput({ sessions: [], plan: { ...proposalInput().plan, since: addDays(MON, 4) } }),
      ),
    ).toEqual([])
  })
})

const benchWeeks = (kgs: number[]) =>
  kgs.map((kg, i) =>
    logged(`s${i}`, addDays(MON, -7 * (kgs.length - i)), [['Barbell Bench Press', 3, kg]], 'Push'),
  )

describe('stalled lifts', () => {
  it('offers a 90% reset, a rep-range change and a fair swap', () => {
    const sessions = [...benchWeeks([80, 82.5, 80, 80, 80]), pushDone, pullDone]
    const stall = buildProposals(proposalInput({ today: addDays(MON, 2), sessions })).find(
      (p) => p.kind === 'stall',
    )
    expect(stall?.title).toBe('Barbell Bench Press has stalled')
    expect(stall!.options.map((o) => o.id)).toEqual(['reset', 'reps', 'swap'])
    expect(stall!.options[0]!.action).toEqual({
      kind: 'reset',
      exerciseId: 'Barbell Bench Press',
      weightKg: 75,
    })
    expect(stall!.options[1]!.label).toBe('Switch to 6–8 reps')
  })

  it('needs 3 workouts with no new best', () => {
    const sessions = [...benchWeeks([80, 82.5, 85, 87.5]), pushDone, pullDone]
    expect(
      buildProposals(proposalInput({ today: addDays(MON, 2), sessions })).some(
        (p) => p.kind === 'stall',
      ),
    ).toBe(false)
  })
})

describe('volume rebalancing', () => {
  it('proposes the plan fix when a muscle is short two weeks running and the plan is short too', () => {
    const muscles = goals({ biceps: { min: 8 } })
    const weeks = [-14, -7].flatMap((d) => [
      logged(`p${d}`, addDays(MON, d), [['Barbell Bench Press', 3, 60]], 'Push'),
      logged(`q${d}`, addDays(MON, d + 1), [['Lat Pulldown', 3, 50]], 'Pull'),
    ])
    const p = buildProposals(proposalInput({ today: MON, sessions: weeks }, muscles)).find(
      (x) => x.kind === 'rebalance',
    )
    expect(p).toMatchObject({ key: `low:biceps:${addDays(MON, -7)}`, title: 'More biceps work' })
    expect(p!.options[0]!.action.kind).toBe('fix')
  })

  it('waits for two full weeks on the plan', () => {
    const muscles = goals({ biceps: { min: 8 } })
    const input = proposalInput({ today: MON }, muscles)
    input.plan = { ...input.plan, since: addDays(MON, -7) }
    expect(buildProposals(input).some((x) => x.kind === 'rebalance')).toBe(false)
  })
})
