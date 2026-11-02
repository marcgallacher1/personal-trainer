import { describe, expect, it } from 'vitest'
import { EXERCISES } from '../seed/exercises'
import { generateSampleHistory, type SampleSession } from '../fixtures/sample'
import {
  matchWorkout,
  rollingAdherence,
  summariseAdherence,
  swapCredit,
  weeklyAdherence,
  type PlannedWorkout,
} from './adherence'
import { exerciseTrend, mostTrained, recentPbs, strengthSeries } from './strength'
import {
  addDays,
  rangeStart,
  weekOf,
  weekdayOf,
  weeksBetween,
  type ExerciseInfo,
  type TrainingSession,
} from './training'
import { intensityLevel, muscleSets, sessionStats, setsPerDay, weeklyVolume } from './volume'

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
const ex = (name: string) => info.get(name)!

/** A logged workout: [exercise, sets, weight, reps] */
function session(
  id: string,
  date: string,
  items: [string, number, number?, number?][],
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
    sets: items.flatMap(([exerciseId, n, weightKg = 50, reps = 10]) =>
      Array.from({ length: n }, () => ({
        exerciseId,
        weightKg,
        reps,
        seconds: null,
        setType: 'working',
        rir: 1,
      })),
    ),
  }
}

const pull: PlannedWorkout = {
  id: 'pull',
  name: 'Pull A',
  perWeek: 1,
  exercises: [
    { exerciseId: 'Lat Pulldown', sets: 3 },
    { exerciseId: 'Face Pull', sets: 3 },
    { exerciseId: 'Incline Dumbbell Curl', sets: 2 },
  ],
}
const push: PlannedWorkout = {
  id: 'push',
  name: 'Push A',
  perWeek: 2,
  exercises: [
    { exerciseId: 'Machine Chest Press', sets: 3 },
    { exerciseId: 'Cable Lateral Raise', sets: 3 },
  ],
}

const pushDone = (id: string, date: string) =>
  session(id, date, [
    ['Machine Chest Press', 3],
    ['Cable Lateral Raise', 3],
  ])

const pullDone = (id: string, date: string) =>
  session(id, date, [
    ['Lat Pulldown', 3],
    ['Face Pull', 3],
    ['Incline Dumbbell Curl', 2],
  ])

/** A summarised week of adherence */
const wk = (week: string, done: number, score: number) => ({
  week,
  planned: 3,
  done,
  score,
  sessions: [],
})

/** One working set of bench press */
const bench = (id: string, date: string, w: number, reps: number) =>
  session(id, date, [['Barbell Bench Press', 1, w, reps]])

describe('dates', () => {
  it('works in Monday-first London weeks', () => {
    expect(weekdayOf('2026-11-02')).toBe(1) // Monday
    expect(weekdayOf('2026-11-08')).toBe(7)
    expect(weekOf('2026-11-08')).toBe('2026-11-02')
    expect(weeksBetween('2026-10-28', '2026-11-03')).toEqual(['2026-10-26', '2026-11-02'])
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02')
    expect(rangeStart('4w', '2026-11-02', null)).toBe('2026-10-06')
    expect(rangeStart('all', '2026-11-02', '2026-01-05')).toBe('2026-01-05')
  })
})

describe('fair swaps', () => {
  it('gives full credit for the same movement and main muscles', () => {
    expect(swapCredit(ex('Lat Pulldown'), ex('Lat Pulldown')).kind).toBe('same')
    expect(swapCredit(ex('Lat Pulldown'), ex('Pull-Up'))).toEqual({ credit: 1, kind: 'fair' })
    expect(swapCredit(ex('Incline Dumbbell Press'), ex('Incline Machine Press')).kind).toBe('fair')
    expect(swapCredit(ex('Cable Lateral Raise'), ex('Dumbbell Lateral Raise')).kind).toBe('fair')
  })

  it('gives partial credit for something related, none for something unrelated', () => {
    const row = swapCredit(ex('Lat Pulldown'), ex('Machine Row'))
    expect(row.kind).toBe('partial')
    expect(row.credit).toBeGreaterThan(0.5)
    expect(row.credit).toBeLessThan(1)
    expect(swapCredit(ex('Lat Pulldown'), ex('Barbell Curl')).credit).toBeLessThan(0.3)
    expect(swapCredit(ex('Lat Pulldown'), ex('Leg Extension'))).toEqual({ credit: 0, kind: 'none' })
  })

  it('matches a logged workout to the plan, counting swaps and missing sets', () => {
    const m = matchWorkout(
      pull,
      [
        { exerciseId: 'Pull-Up', sets: 3 }, // fair swap for Lat Pulldown
        { exerciseId: 'Face Pull', sets: 2 }, // 2 of 3 sets
        { exerciseId: 'Barbell Shrug', sets: 3 }, // extra
      ],
      info,
    )
    expect(m.exercises.map((e) => [e.plannedId, e.doneId, e.kind])).toEqual([
      ['Lat Pulldown', 'Pull-Up', 'fair'],
      ['Face Pull', 'Face Pull', 'same'],
      ['Incline Dumbbell Curl', null, 'none'],
    ])
    // (1 + 2/3 + 0) / 3
    expect(m.score).toBeCloseTo(5 / 9, 5)
    expect(m.extras).toEqual(['Barbell Shrug'])
  })

  it('prefers exact matches over equally good swaps', () => {
    const m = matchWorkout(
      { ...pull, exercises: [{ exerciseId: 'Lat Pulldown', sets: 3 }] },
      [
        { exerciseId: 'Pull-Up', sets: 3 },
        { exerciseId: 'Lat Pulldown', sets: 3 },
      ],
      info,
    )
    expect(m.exercises[0]!.doneId).toBe('Lat Pulldown')
  })
})

describe('weekly adherence', () => {
  it('fills each week’s planned slots with the best-matching workouts', () => {
    // Week of 19 Oct: everything (3/3). Week of 26 Oct: Push once, plus an arms day.
    const weeks = weeklyAdherence(
      [push, pull],
      [
        pushDone('a', '2026-10-19'),
        pullDone('b', '2026-10-21'),
        pushDone('c', '2026-10-23'),
        pushDone('d', '2026-10-27'),
        session('e', '2026-10-29', [['Barbell Curl', 3]]),
      ],
      info,
      '2026-10-19',
      '2026-11-01',
    )
    expect(weeks.map((w) => [w.week, w.planned, w.done])).toEqual([
      ['2026-10-19', 3, 3],
      ['2026-10-26', 3, 2],
    ])
    expect(weeks[0]!.score).toBe(1)
    // Push A once (1 of 2 slots), and the arms day stands in for a third of Pull A (its curl)
    expect(weeks[1]!.score).toBeCloseTo((1 + 1 / 3) / 3, 5)
    expect(weeks[1]!.sessions.find((s) => s.sessionId === 'e')!.workoutId).toBe('pull')
  })

  it('counts a workout started from the plan even if it went off-script', () => {
    const [w] = weeklyAdherence(
      [pull],
      [session('x', '2026-10-20', [['Barbell Curl', 3]], 'pull')],
      info,
      '2026-10-19',
      '2026-10-25',
    )
    expect(w!.sessions[0]!.workoutName).toBe('Pull A')
    expect(w!.score).toBeCloseTo(1 / 3, 5) // only the curl stands in (partially) for the curl slot
  })

  it('summarises the last finished weeks and streaks', () => {
    const weeks = [
      wk('2026-10-05', 3, 1),
      wk('2026-10-12', 1, 0.3),
      wk('2026-10-19', 3, 0.9),
      wk('2026-10-26', 4, 1),
      wk('2026-11-02', 1, 0.3), // this week, in progress
    ]
    const s = summariseAdherence(weeks, '2026-11-03')
    expect(s.score).toBeCloseTo((1 + 0.3 + 0.9 + 1) / 4, 5)
    expect(s.thisWeek?.done).toBe(1)
    expect(s.currentStreak).toBe(2)
    expect(s.longestStreak).toBe(2)
    expect(rollingAdherence(weeks, 2).map((r) => r.value)).toEqual([1, 0.65, 0.6, 0.95, 0.65])
  })
})

describe('volume', () => {
  const sessions = [
    session('a', '2026-10-27', [
      ['Barbell Bench Press', 4, 80, 8], // chest 4, front delts 2, triceps 2
      ['Lat Pulldown', 3, 60, 10], // lats 3, biceps 1.5, upper back 1.5
    ]),
    session('b', '2026-10-29', [['Cable Lateral Raise', 3, 10, 15]]),
  ]

  it('counts weighted sets per muscle', () => {
    const m = muscleSets(sessions, info)
    expect(m.get('chest')).toBe(4)
    expect(m.get('front_delts')).toBe(2)
    expect(m.get('lats')).toBe(3)
    expect(m.get('biceps')).toBe(1.5)
    expect(m.get('side_delts')).toBe(3)
  })

  it('totals each week by muscle group, with tonnage', () => {
    const [w] = weeklyVolume(sessions, info, ['2026-10-26'])
    expect(w!.sets).toBe(10)
    expect(w!.tonnage).toBe(4 * 80 * 8 + 3 * 60 * 10 + 3 * 10 * 15) // 2560 + 1800 + 450
    expect(w!.groups.chest).toBe(4)
    expect(w!.groups.arms).toBe(2 + 1.5) // triceps from bench + biceps from pulldown
    expect(w!.groups.legs).toBe(0)
  })

  it('shades calendar days by working sets', () => {
    expect(setsPerDay(sessions).get('2026-10-27')).toBe(7)
    expect([0, 1, 9, 10, 17, 18, 25, 26].map(intensityLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4])
  })

  it('reports duration and average effort per workout', () => {
    const [s] = sessionStats(sessions)
    expect(s).toMatchObject({ minutes: 60, avgRir: 1, sets: 7 })
  })
})

describe('strength', () => {
  // e1RM = w × (1 + reps/30): 80×8 → 101.3, 82.5×8 → 104.5, 85×6 → 102, 85×8 → 107.7
  const history = [
    bench('1', '2026-09-01', 80, 8),
    bench('2', '2026-09-08', 82.5, 8),
    bench('3', '2026-09-15', 85, 6),
    bench('4', '2026-09-22', 85, 8),
  ]

  it('tracks best e1RM per workout with PB markers', () => {
    const series = strengthSeries(history, 'Barbell Bench Press')
    expect(series.map((p) => [p.e1rm, p.pb])).toEqual([
      [101.3, false],
      [104.5, true],
      [102, false],
      [107.7, true],
    ])
  })

  it('flags a stall after 3 workouts without a new best', () => {
    const stuck = [
      ...history,
      bench('5', '2026-09-29', 85, 7),
      bench('6', '2026-10-06', 85, 8),
      bench('7', '2026-10-13', 82.5, 8),
    ]
    const t = exerciseTrend('Barbell Bench Press', strengthSeries(stuck, 'Barbell Bench Press'))!
    expect(t.stalled).toBe(true)
    expect(t.sinceBest).toBe(3)
    expect(t.best).toBe(107.7)
    expect(
      exerciseTrend('Barbell Bench Press', strengthSeries(history, 'Barbell Bench Press'))!.stalled,
    ).toBe(false)
  })

  it('lists PBs newest first with how much they beat the old best by', () => {
    const pbs = recentPbs(history, ['Barbell Bench Press'])
    expect(pbs.map((p) => [p.date, p.gain])).toEqual([
      ['2026-09-22', 3.2],
      ['2026-09-08', 3.2],
    ])
    expect(mostTrained(history)).toEqual(['Barbell Bench Press'])
  })
})

describe('sample history', () => {
  const plan = [
    {
      id: 'push',
      name: 'Push A',
      days: [1, 4],
      exercises: [
        { exerciseId: 'Incline Dumbbell Press', sets: 3, repsMin: 8, repsMax: 12 },
        { exerciseId: 'Cable Lateral Raise', sets: 3, repsMin: 12, repsMax: 15 },
        { exerciseId: 'Plank', sets: 2, repsMin: 30, repsMax: 60 },
      ],
    },
    {
      id: 'pull',
      name: 'Pull A',
      days: [2, 5],
      exercises: [
        { exerciseId: 'Lat Pulldown', sets: 3, repsMin: 8, repsMax: 12 },
        { exerciseId: 'Face Pull', sets: 3, repsMin: 12, repsMax: 15 },
      ],
    },
  ]
  const gen = (seed = 7): SampleSession[] =>
    generateSampleHistory({ plan, info, today: '2026-11-02', weeks: 12, seed })

  it('is repeatable, plausible, and never in the future', () => {
    const a = gen()
    expect(gen()).toEqual(a)
    expect(gen(8)).not.toEqual(a)
    // 4 planned a week × 12 weeks, ~85% attended
    expect(a.length).toBeGreaterThan(30)
    expect(a.length).toBeLessThan(48)
    expect(a.every((s) => s.date < '2026-11-02')).toBe(true)
    const plank = a.flatMap((s) => s.exercises).find((e) => e.exerciseId === 'Plank')
    expect(plank?.sets[0]).toMatchObject({ reps: 0, weightKg: 0 })
    expect(plank?.sets[0]?.seconds).toBeGreaterThan(0)
  })

  it('includes fair swaps and a stalled lift, which the analysis picks up', () => {
    const sessions: TrainingSession[] = gen().map((s, i) => ({
      id: `s${i}`,
      date: s.date,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      name: s.name,
      planId: 'plan',
      planSessionId: s.planSessionId,
      sets: s.exercises.flatMap((e) =>
        e.sets.map((x) => ({
          exerciseId: e.exerciseId,
          weightKg: x.weightKg,
          reps: x.reps,
          seconds: x.seconds,
          setType: 'working',
          rir: x.rir,
        })),
      ),
    }))
    const planned = new Set(plan.flatMap((w) => w.exercises.map((e) => e.exerciseId)))
    const swapped = sessions.flatMap((s) => s.sets).filter((x) => !planned.has(x.exerciseId))
    expect(swapped.length).toBeGreaterThan(0)

    const weeks = weeklyAdherence(
      plan.map((w) => ({ id: w.id, name: w.name, perWeek: w.days.length, exercises: w.exercises })),
      sessions,
      info,
      sessions[0]!.date,
      '2026-11-01',
    )
    const summary = summariseAdherence(weeks, '2026-11-02')
    expect(summary.score).toBeGreaterThan(0.6)
    expect(summary.score).toBeLessThan(1)

    const pulldown = exerciseTrend('Lat Pulldown', strengthSeries(sessions, 'Lat Pulldown'))!
    expect(pulldown.stalled).toBe(true)
    const press = exerciseTrend(
      'Incline Dumbbell Press',
      strengthSeries(sessions, 'Incline Dumbbell Press'),
    )!
    expect(press.changePct).toBeGreaterThan(3)
  })
})
