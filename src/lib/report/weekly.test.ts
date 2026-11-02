import { describe, expect, it } from 'vitest'
import type { PlannedWorkout } from '../analysis/adherence'
import type { ExerciseInfo, TrainingSession } from '../analysis/training'
import { addDays } from '../analysis/training'
import { ratePlan, type MuscleGoal, type RatingWorkout } from '../rating/rate'
import { EXERCISES } from '../seed/exercises'
import { MUSCLES } from '../seed/muscles'
import { isoWeek } from '../time/london'
import { buildWeeklyReport, listNames, mondayOfIsoWeek, reportId, type ReportInput } from './weekly'

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

const LEGS = ['glutes', 'quads', 'hamstrings', 'adductors', 'calves']
const goals = (over: Partial<Record<string, Partial<MuscleGoal>>> = {}): MuscleGoal[] =>
  MUSCLES.map((m) => ({
    id: m.id,
    name: m.name,
    min: 0,
    max: 20,
    priority: false,
    paused: LEGS.includes(m.id),
    ...over[m.id],
  }))

/** A logged workout: [exercise, sets, weight, reps, rir] */
function session(
  id: string,
  date: string,
  items: [string, number, number?, number?, number?][],
  planSessionId: string | null = null,
): TrainingSession {
  return {
    id,
    date,
    startedAt: `${date}T18:00:00.000Z`,
    endedAt: `${date}T19:00:00.000Z`,
    name: id,
    planId: null,
    planSessionId,
    sets: items.flatMap(([exerciseId, n, weightKg = 50, reps = 10, rir = 1]) =>
      Array.from({ length: n }, () => ({
        exerciseId,
        weightKg,
        reps,
        seconds: null,
        setType: 'working',
        rir,
      })),
    ),
  }
}

const PUSH: PlannedWorkout = {
  id: 'push',
  name: 'Push A',
  perWeek: 2,
  exercises: [
    { exerciseId: 'Barbell Bench Press', sets: 3 },
    { exerciseId: 'Cable Lateral Raise', sets: 3 },
  ],
}
const PULL: PlannedWorkout = {
  id: 'pull',
  name: 'Pull A',
  perWeek: 1,
  exercises: [
    { exerciseId: 'Lat Pulldown', sets: 3 },
    { exerciseId: 'Face Pull', sets: 3 },
  ],
}

function plan(workouts: PlannedWorkout[], muscles = goals()): NonNullable<ReportInput['plan']> {
  const rating = ratePlan({
    mode: 'plan',
    exercises: info,
    muscles,
    focus: 'hypertrophy',
    workouts: workouts.map((w): RatingWorkout => ({
      id: w.id,
      name: w.name,
      timesPerWeek: w.perWeek,
      days: [],
      exercises: w.exercises.map((e, i) => ({
        id: `${w.id}-${i}`,
        exerciseId: e.exerciseId,
        sets: Array.from({ length: e.sets }, () => ({
          set_type: 'working',
          reps_min: 8,
          reps_max: 12,
          seconds_min: null,
          seconds_max: null,
          target_rir: 1,
        })),
      })),
    })),
  })
  return { id: 'plan-1', workouts, since: '2026-01-01', rating }
}

const WEEK = '2026-10-26'
const SUN = addDays(WEEK, 6)

function input(over: Partial<ReportInput> = {}): ReportInput {
  return {
    week: WEEK,
    today: SUN,
    sessions: [],
    ctx: { exercises: info, muscles: goals(), focus: 'hypertrophy' },
    plan: plan([PUSH, PULL]),
    protein: { logs: [], target: null },
    ...over,
  }
}

const pushDay = (id: string, date: string, kg = 60): TrainingSession =>
  session(
    id,
    date,
    [
      ['Barbell Bench Press', 3, kg, 8],
      ['Cable Lateral Raise', 3, 10, 12],
    ],
    'push',
  )
const pullDay = (id: string, date: string): TrainingSession =>
  session(
    id,
    date,
    [
      ['Lat Pulldown', 3, 50, 10],
      ['Face Pull', 3, 20, 12],
    ],
    'pull',
  )

describe('mondayOfIsoWeek', () => {
  it('finds the Monday of an ISO week', () => {
    expect(mondayOfIsoWeek('2026-W45')).toBe('2026-11-02')
    expect(mondayOfIsoWeek('2026-W01')).toBe('2025-12-29')
    expect(mondayOfIsoWeek('2021-W53')).toBe('2022-01-03')
  })

  it('round-trips with isoWeek', () => {
    for (let d = '2025-12-01'; d < '2027-02-01'; d = addDays(d, 3)) {
      const monday = mondayOfIsoWeek(isoWeek(d))!
      expect(monday <= d && d <= addDays(monday, 6)).toBe(true)
    }
  })

  it('rejects junk', () => {
    expect(mondayOfIsoWeek('2026-45')).toBeNull()
    expect(mondayOfIsoWeek('2026-W60')).toBeNull()
  })
})

describe('listNames', () => {
  it('joins names in plain English', () => {
    expect(listNames([])).toBe('')
    expect(listNames(['A'])).toBe('A')
    expect(listNames(['A', 'B'])).toBe('A and B')
    expect(listNames(['A', 'B', 'C'])).toBe('A, B and C')
  })
})

describe('buildWeeklyReport', () => {
  it('celebrates a full week and asks for no catch-up', () => {
    const r = buildWeeklyReport(
      input({
        sessions: [
          pushDay('a', WEEK),
          pullDay('b', addDays(WEEK, 2)),
          pushDay('c', addDays(WEEK, 4)),
        ],
      }),
    )
    expect(r.final).toBe(true)
    expect(r.workouts).toEqual({ done: 3, planned: 3, missed: [] })
    expect(r.headline).toMatch(/^Full week: 3 of 3 workouts/)
    expect(r.actions.some((a) => a.kind === 'missed')).toBe(false)
    expect(r.actions.length).toBeGreaterThan(0)
    expect(r.actions.length).toBeLessThanOrEqual(3)
  })

  it('names missed workouts first', () => {
    const r = buildWeeklyReport(input({ sessions: [pushDay('a', WEEK)] }))
    expect(r.workouts.missed.toSorted()).toEqual(['Pull A', 'Push A'])
    expect(r.actions[0]?.kind).toBe('missed')
    expect(r.actions[0]?.title).toMatch(/Don’t skip (Push A and Pull A|Pull A and Push A)/)
    expect(r.headline).toBe('1 of 3 workouts.')
  })

  it('reads as "so far" mid-week', () => {
    const r = buildWeeklyReport(input({ today: addDays(WEEK, 2), sessions: [pushDay('a', WEEK)] }))
    expect(r.final).toBe(false)
    expect(r.headline).toMatch(/^So far: /)
    expect(r.actions[0]?.title).toMatch(/^Still to do:/)
  })

  it('handles an empty week', () => {
    const r = buildWeeklyReport(input())
    expect(r.headline).toBe('No workouts logged this week.')
    expect(r.actions[0]?.title).toBe('Get one workout in early')
  })

  it('flags a stalled lift with a 90% reset', () => {
    const weeks = [-35, -28, -21, -14, -7, 0]
    const sessions = weeks.map((d, i) => pushDay(`s${i}`, addDays(WEEK, d), i === 1 ? 82.5 : 80))
    const r = buildWeeklyReport(input({ sessions }))
    expect(r.stalls.find((x) => x.name === 'Barbell Bench Press')).toMatchObject({
      name: 'Barbell Bench Press',
      workouts: 4,
      resetKg: 75,
    })
    const action = r.actions.find((a) => a.kind === 'stall')
    expect(action?.detail).toContain('75 kg')
    expect(action?.link?.to).toBe('/exercises/Barbell Bench Press')
  })

  it('lists PBs set this week only', () => {
    const r = buildWeeklyReport(
      input({ sessions: [pushDay('a', addDays(WEEK, -7), 60), pushDay('b', WEEK, 65)] }),
    )
    expect(r.pbs).toEqual([expect.objectContaining({ name: 'Barbell Bench Press', weightKg: 65 })])
    expect(r.headline).toContain('1 PB')
  })

  it('suggests an exercise for a short muscle when there is no plan', () => {
    const r = buildWeeklyReport(
      input({
        plan: null,
        ctx: { exercises: info, muscles: goals({ biceps: { min: 8 } }), focus: 'hypertrophy' },
        sessions: [pushDay('a', WEEK)],
      }),
    )
    const low = r.actions.find((a) => a.id === 'low:biceps')
    expect(low?.title).toBe('Add 4 sets of Incline Dumbbell Curl')
    expect(r.actions.some((a) => a.kind === 'plan')).toBe(true)
  })

  it('points at the plan when the plan is short too', () => {
    const muscles = goals({ biceps: { min: 8 } })
    const r = buildWeeklyReport(
      input({
        ctx: { exercises: info, muscles, focus: 'hypertrophy' },
        plan: plan([PUSH, PULL], muscles),
        sessions: [
          pushDay('a', WEEK),
          pullDay('b', addDays(WEEK, 2)),
          pushDay('c', addDays(WEEK, 4)),
        ],
      }),
    )
    const low = r.actions.find((a) => a.id === 'low:biceps')
    expect(low?.link?.to).toBe('/plans/plan-1/rating')
  })

  it('keeps to 3 actions with at most 2 muscle ones', () => {
    const muscles = goals({
      biceps: { min: 8 },
      triceps: { min: 8 },
      abs: { min: 8 },
      upper_back: { min: 8 },
    })
    const r = buildWeeklyReport(
      input({
        plan: null,
        ctx: { exercises: info, muscles, focus: null },
        sessions: [pushDay('a', WEEK)],
      }),
    )
    expect(r.actions).toHaveLength(3)
    expect(r.actions.filter((a) => a.kind === 'low')).toHaveLength(2)
  })

  it('warns when a muscle is well over its max', () => {
    const r = buildWeeklyReport(
      input({
        plan: null,
        ctx: { exercises: info, muscles: goals({ side_delts: { max: 1 } }), focus: null },
        sessions: [pushDay('a', WEEK)],
      }),
    )
    expect(r.actions.find((a) => a.id === 'high:side_delts')?.title).toBe('Ease off side delts')
  })

  it('summarises protein and nudges when it’s often missed', () => {
    const logs = [0, 1, 2, 3].map((d) => ({ date: addDays(WEEK, d), grams: d === 0 ? 150 : 90 }))
    logs.push({ date: addDays(WEEK, 7), grams: 300 })
    const r = buildWeeklyReport(input({ protein: { logs, target: 150 } }))
    expect(r.protein).toEqual({ days: 4, hit: 1, avg: 105, target: 150 })
    expect(r.actions.some((a) => a.kind === 'protein')).toBe(true)
  })

  it('leaves protein out when nothing was logged', () => {
    expect(buildWeeklyReport(input({ protein: { logs: [], target: 150 } })).protein).toBeNull()
  })

  it('suggests more effort when sets are left far from failure', () => {
    const easy = session('a', WEEK, [['Barbell Bench Press', 6, 60, 8, 4]], 'push')
    const r = buildWeeklyReport(input({ plan: null, sessions: [easy] }))
    expect(r.rir).toBe(4)
    expect(r.actions.some((a) => a.kind === 'effort')).toBe(true)
  })

  it('compares volume with last week', () => {
    const r = buildWeeklyReport(
      input({
        sessions: [
          pushDay('x', addDays(WEEK, -7)),
          pushDay('a', WEEK),
          pullDay('b', addDays(WEEK, 2)),
          pushDay('c', addDays(WEEK, 4)),
        ],
      }),
    )
    expect(r.last).toMatchObject({ done: 1, sets: 6 })
    expect(r.sets).toBe(18)
    expect(r.headline).toContain('Up 200% on last week’s sets.')
  })

  it('spots pushing far more than pulling', () => {
    const r = buildWeeklyReport(
      input({ plan: null, sessions: [pushDay('a', WEEK), pushDay('b', addDays(WEEK, 2))] }),
    )
    expect(r.balance[0]).toMatch(/More pushing than pulling/)
    expect(r.actions.some((a) => a.kind === 'balance')).toBe(true)
  })

  it('counts the streak of full weeks', () => {
    const sessions = [-14, -7, 0].flatMap((d) => [
      pushDay(`a${d}`, addDays(WEEK, d)),
      pullDay(`b${d}`, addDays(WEEK, d + 2)),
      pushDay(`c${d}`, addDays(WEEK, d + 4)),
    ])
    expect(buildWeeklyReport(input({ sessions })).streak).toBe(3)
  })
})

describe('reportId', () => {
  it('is a stable UUID per user and week', () => {
    const a = reportId('user-1', '2026-W45')
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(reportId('user-1', '2026-W45')).toBe(a)
    expect(reportId('user-1', '2026-W46')).not.toBe(a)
    expect(reportId('user-2', '2026-W45')).not.toBe(a)
  })
})
