import { describe, expect, it } from 'vitest'
import { EXERCISES } from '../seed/exercises'
import { MUSCLES } from '../seed/muscles'
import type { TargetLike } from '../plans/targets'
import { TEMPLATES } from '../plans/templates'
import { loggedWorkouts, planWorkouts } from './inputs'
import {
  planVsActual,
  rangeFor,
  ratePlan,
  type MuscleGoal,
  type Rating,
  type RatingExercise,
  type RatingInput,
  type RatingWorkout,
  type SubScoreId,
} from './rate'
import { PATTERNS, SUGGEST_FOR_MUSCLE } from './rules'

const catalogue: Map<string, RatingExercise> = new Map(
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

/** Muscle goals at the generic 10–20, with legs paused like the user's. */
function goals(over: Partial<Record<string, Partial<MuscleGoal>>> = {}): MuscleGoal[] {
  return MUSCLES.map((m) => ({
    id: m.id,
    name: m.name,
    min: 10,
    max: 20,
    priority: false,
    paused: LEGS.includes(m.id),
    ...over[m.id],
  }))
}

const sets = (n: number, min = 8, max = 12, rir: number | null = 1): TargetLike[] =>
  Array.from({ length: n }, () => ({
    set_type: 'working',
    reps_min: min,
    reps_max: max,
    seconds_min: null,
    seconds_max: null,
    target_rir: rir,
  }))

/** A workout from a preset, e.g. Push A, on the given days. */
function preset(templateId: string, version: string, days: number[]): RatingWorkout {
  const s = TEMPLATES.find((t) => t.id === templateId)!.sessions.find((v) => v.name === version)!
  return {
    id: `${templateId}-${version}`,
    name: `${templateId} ${version}`,
    timesPerWeek: Math.max(1, days.length),
    days,
    exercises: s.exercises.map((e, i) => ({
      id: `${templateId}-${version}-${i}`,
      exerciseId: e.name,
      sets: sets(e.sets, e.min, e.max, e.rir),
    })),
  }
}

/** A workout of one exercise, e.g. 4 sets of Machine Chest Press on Mon. */
const one = (
  id: string,
  exerciseId: string,
  n: number,
  days: number[],
  min = 8,
  max = 12,
): RatingWorkout => ({
  id,
  name: id,
  timesPerWeek: days.length,
  days,
  exercises: [{ id: `${id}-pe`, exerciseId, sets: sets(n, min, max) }],
})

/** 5 sets of Machine Chest Press on one day */
const chestDay = (id: string, day: number) => one(id, 'Machine Chest Press', 5, [day])
/** Machine Chest Press twice a week in a given rep range */
const pressing = (min: number, max: number) => one('w', 'Machine Chest Press', 5, [1, 4], min, max)

const subscore = (r: Rating, id: SubScoreId) => r.subscores.find((s) => s.id === id)!.score

/** A plan set target row */
const t = (peId: string, order: number, deleted = false) => ({
  ...sets(1)[0]!,
  plan_exercise_id: peId,
  order,
  deleted_at: deleted ? 'x' : null,
})

/** A logged set of Machine Chest Press */
const set = (session_id: string) => ({
  session_id,
  exercise_id: 'Machine Chest Press',
  reps: 10,
  rir: 1,
  set_type: 'working',
})

const input = (workouts: RatingWorkout[], over: Partial<RatingInput> = {}): RatingInput => ({
  mode: 'plan',
  workouts,
  exercises: catalogue,
  muscles: goals(),
  focus: 'hypertrophy',
  ...over,
})

describe('rules', () => {
  it('only suggest exercises from the catalogue', () => {
    for (const names of Object.values(SUGGEST_FOR_MUSCLE)) {
      for (const n of names) expect(catalogue.has(n), n).toBe(true)
    }
    for (const p of PATTERNS) for (const n of p.suggest) expect(catalogue.has(n), n).toBe(true)
  })

  it('use muscle-specific ranges unless the user set their own, and aim higher for priorities', () => {
    expect(rangeFor({ id: 'rear_delts', min: 10, max: 20, priority: false })).toEqual({
      min: 8,
      max: 16,
    })
    expect(rangeFor({ id: 'rear_delts', min: 6, max: 9, priority: false })).toEqual({
      min: 6,
      max: 9,
    })
    expect(rangeFor({ id: 'side_delts', min: 10, max: 20, priority: true })).toEqual({
      min: 14,
      max: 20,
    })
  })
})

describe('ratePlan', () => {
  // The user's sort of week: Push A Mon, Pull A Tue, Push B Thu, Pull B Fri
  const week = [
    preset('push', 'A', [1]),
    preset('pull', 'A', [2]),
    preset('push', 'B', [4]),
    preset('pull', 'B', [5]),
  ]

  it('rates a sensible upper-body week well, without counting paused legs against it', () => {
    const r = ratePlan(input(week))
    expect(r.score).toBeGreaterThanOrEqual(70)
    expect(r.workoutsPerWeek).toBe(4)
    expect(r.muscles.find((m) => m.id === 'quads')?.status).toBe('paused')
    expect(r.lacking.map((l) => l.text).join(' ')).not.toMatch(/quads|squat|hinge|hamstring/i)
    expect(r.strengths.some((s) => s.includes('Paused muscles'))).toBe(true)
    expect(r.subscores.map((s) => s.id)).toEqual([
      'volume',
      'balance',
      'frequency',
      'coverage',
      'recovery',
      'goal',
    ])
  })

  it('expects leg work once legs are switched back on', () => {
    const withLegs = ratePlan(input(week, { muscles: goals({ quads: { paused: false } }) }))
    expect(withLegs.lacking.some((l) => l.text.startsWith('Quads'))).toBe(true)
    // Its fix (Leg Press) also covers the missing squat, so that isn't listed twice
    const quads = withLegs.lacking.find((l) => l.muscleId === 'quads')
    expect(quads?.fix).toMatchObject({ kind: 'add', exerciseId: 'Leg Press' })
    expect(withLegs.lacking.some((l) => l.text === 'No squat yet.')).toBe(false)
    expect(withLegs.score).toBeLessThan(ratePlan(input(week)).score)
  })

  it('counts secondary movers as half a set and spreads frequency across the week', () => {
    const w: RatingWorkout = {
      id: 'w',
      name: 'Chest day',
      timesPerWeek: 2,
      days: [1, 4],
      exercises: [{ id: 'pe', exerciseId: 'Barbell Bench Press', sets: sets(4) }],
    }
    const r = ratePlan(input([w]))
    const chest = r.muscles.find((m) => m.id === 'chest')!
    expect(chest.sets).toBe(8) // 4 sets × 2 days
    expect(chest.frequency).toBe(2)
    expect(r.muscles.find((m) => m.id === 'triceps')!.sets).toBe(4) // half of 8
    expect(r.muscles.find((m) => m.id === 'chest')!.status).toBe('low')
  })

  it('flags missing muscles and patterns with a one-tap fix in the best-suited workout', () => {
    const pushOnly = [preset('push', 'A', [1]), preset('push', 'B', [4])]
    const r = ratePlan(input(pushOnly))
    const lats = r.lacking.find((l) => l.muscleId === 'lats')!
    expect(lats.text).toMatch(/^Lats: no direct work yet/)
    expect(lats.fix).toMatchObject({ kind: 'add', exerciseId: 'Lat Pulldown' })
    // Short on upper back too; its fix adds a row, which also covers the missing pattern
    expect(r.lacking.find((l) => l.muscleId === 'upper_back')?.fix).toMatchObject({
      exerciseId: 'Chest-Supported Dumbbell Row',
    })
    expect(r.lacking.some((l) => l.text === 'No row yet.')).toBe(false)
    expect(r.subscores.find((s) => s.id === 'coverage')!.summary).toMatch(/row/)
    // The same exercise is never suggested twice
    const added = r.lacking.flatMap((l) => (l.fix?.kind === 'add' ? [l.fix.exerciseId] : []))
    expect(new Set(added).size).toBe(added.length)
    expect(r.lacking.some((l) => l.text.includes('no rows or pulldowns'))).toBe(true)
  })

  it('puts a missing rear-delt exercise in a pull workout, not a push one', () => {
    const r = ratePlan(
      input([one('push', 'Machine Chest Press', 4, [1]), one('pull', 'Machine Row', 4, [3])]),
    )
    const fix = r.lacking.find((l) => l.muscleId === 'rear_delts')?.fix
    expect(fix).toMatchObject({ kind: 'add', workoutId: 'pull', exerciseId: 'Reverse Pec Deck' })
  })

  it('calls out junk volume and offers to trim the biggest contributor', () => {
    const w: RatingWorkout = {
      id: 'chest',
      name: 'Chest',
      timesPerWeek: 3,
      days: [1, 3, 5],
      exercises: [
        { id: 'a', exerciseId: 'Machine Chest Press', sets: sets(5) },
        { id: 'b', exerciseId: 'Cable Fly', sets: sets(4) },
      ],
    }
    const r = ratePlan(input([w]))
    const chest = r.overdone.find((o) => o.muscleId === 'chest')!
    expect(chest.text).toMatch(/^Chest: 27 sets a week/)
    expect(chest.fix).toMatchObject({ kind: 'sets', planExerciseId: 'a' })
    expect(chest.fix?.text).toMatch(/^Drop \d sets? of Machine Chest Press in Chest \(5 → \d\)$/)
  })

  it('treats priority muscles as more important', () => {
    const plain = ratePlan(input(week))
    const prio = ratePlan(input(week, { muscles: goals({ side_delts: { priority: true } }) }))
    const side = prio.muscles.find((m) => m.id === 'side_delts')!
    expect(side.priority).toBe(true)
    expect(side.min).toBeGreaterThan(plain.muscles.find((m) => m.id === 'side_delts')!.min)
  })

  it('notices the same muscle hammered on back-to-back days (incl. Sunday → Monday)', () => {
    const spaced = ratePlan(input([chestDay('a', 1), chestDay('b', 4)]))
    const backToBack = ratePlan(input([chestDay('a', 7), chestDay('b', 1)]))
    expect(backToBack.lacking.some((l) => l.text.includes('back-to-back'))).toBe(true)
    expect(subscore(backToBack, 'recovery')).toBeLessThan(subscore(spaced, 'recovery'))
  })

  it('marks rep ranges that do not suit the goal', () => {
    expect(subscore(ratePlan(input([pressing(8, 12)])), 'goal')).toBe(100)
    expect(subscore(ratePlan(input([pressing(1, 3)])), 'goal')).toBeLessThan(50)
    expect(
      subscore(ratePlan(input([pressing(1, 3)], { focus: 'strength' })), 'goal'),
    ).toBeGreaterThan(subscore(ratePlan(input([pressing(12, 15)], { focus: 'strength' })), 'goal'))
  })

  it('gives an empty plan a zero, with nothing to praise', () => {
    const r = ratePlan(input([]))
    expect(r.score).toBe(0)
    expect(r.strengths).toEqual([])
  })
})

describe('inputs', () => {
  it('turns a plan into a week, ignoring deleted rows; workouts without days count once', () => {
    const live = { deleted_at: null }
    const w = planWorkouts({
      sessions: [
        { id: 's1', name: 'Push A', ...live },
        { id: 's2', name: 'Arms', ...live },
        { id: 's3', name: 'Gone', deleted_at: 'x' },
      ],
      schedule: [
        { plan_session_id: 's1', weekday: 4, ...live },
        { plan_session_id: 's1', weekday: 1, ...live },
        { plan_session_id: 's1', weekday: 3, deleted_at: 'x' },
      ],
      exercises: [{ id: 'pe1', plan_session_id: 's1', exercise_id: 'e1', order: 0, ...live }],
      targets: [t('pe1', 0), t('pe1', 1), t('pe1', 2, true)],
    })
    expect(w.map((x) => [x.name, x.days, x.timesPerWeek])).toEqual([
      ['Push A', [1, 4], 2],
      ['Arms', [], 1],
    ])
    expect(w[0]!.exercises[0]!.sets).toHaveLength(2)
  })

  it('averages logged workouts over the weeks you have actually been logging (max 4)', () => {
    const { workouts, weeks } = loggedWorkouts(
      [
        { id: 'old', name: 'Old', date: '2026-08-01' },
        { id: 'a', name: 'Push', date: '2026-10-17' },
        { id: 'b', name: null, date: '2026-10-29' },
        { id: 'empty', name: 'Empty', date: '2026-10-28' },
      ],
      [set('old'), set('a'), set('a'), set('b')],
      '2026-10-30',
    )
    expect(weeks).toBe(2) // 17th → 30th
    expect(workouts.map((w) => [w.name, w.timesPerWeek])).toEqual([
      ['Push', 0.5],
      ['Workout', 0.5],
    ])
    const r = ratePlan(input(workouts, { mode: 'actual', weeks }))
    expect(r.muscles.find((m) => m.id === 'chest')!.sets).toBe(1.5) // 3 sets over 2 weeks
    expect(r.lacking.every((l) => !l.fix)).toBe(true) // no fixes for logged training
  })

  it('compares plan and reality per muscle', () => {
    const plan = ratePlan(input([preset('push', 'A', [1, 4])]))
    const actual = ratePlan(input([preset('push', 'A', [1])], { mode: 'actual', weeks: 1 }))
    const gaps = planVsActual(plan, actual)
    expect(gaps.map((g) => g.id)).toContain('chest')
    expect(gaps.every((g) => g.planned > g.actual)).toBe(true)
  })
})
