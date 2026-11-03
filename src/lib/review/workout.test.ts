import { describe, expect, it } from 'vitest'
import type { PlannedWorkout } from '../analysis/adherence'
import type { ExerciseInfo, TrainingSession } from '../analysis/training'
import { EXERCISES } from '../seed/exercises'
import { reviewWorkout } from './workout'

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

/** [exercise, sets, kg, reps, rir] */
function workout(
  id: string,
  date: string,
  items: [string, number, number, number, number?][],
  minutes = 60,
): TrainingSession {
  const startedAt = `${date}T18:00:00.000Z`
  return {
    id,
    date,
    startedAt,
    endedAt: new Date(Date.parse(startedAt) + minutes * 60_000).toISOString(),
    name: id,
    planId: null,
    planSessionId: null,
    sets: items.flatMap(([exerciseId, n, weightKg, reps, rir = 1]) =>
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
  name: 'Push',
  perWeek: 1,
  exercises: [
    { exerciseId: 'Barbell Bench Press', sets: 3 },
    { exerciseId: 'Cable Lateral Raise', sets: 3 },
  ],
}

describe('workout review', () => {
  const last = workout('a', '2026-10-27', [
    ['Barbell Bench Press', 3, 60, 8],
    ['Cable Lateral Raise', 3, 10, 12],
  ])

  it('rewards beating last time and doing the full plan', () => {
    const now = workout('b', '2026-11-03', [
      ['Barbell Bench Press', 3, 62.5, 8],
      ['Cable Lateral Raise', 3, 10, 13],
    ])
    const r = reviewWorkout({ session: now, history: [last, now], info, planned: PUSH })!
    expect(r.score).toBeGreaterThanOrEqual(85)
    expect(r.verdict).toBe('Great session')
    expect(r.good).toContain('Beat last time on Barbell Bench Press and Cable Lateral Raise.')
    expect(r.good).toContain('Did the full plan.')
    expect(r.improve).toEqual([])
  })

  it('points out drops, skipped plan exercises and easy sets, briefly', () => {
    const now = workout('b', '2026-11-03', [['Barbell Bench Press', 3, 50, 8, 4]], 120)
    const r = reviewWorkout({ session: now, history: [last, now], info, planned: PUSH })!
    expect(r.score).toBeLessThan(55)
    expect(r.improve).toEqual([
      'Down on Barbell Bench Press. Rest more, or check sleep and food.',
      'Skipped Cable Lateral Raise from the plan.',
      'Most sets had 3+ reps left. Push a bit closer to failure.',
    ])
    for (const b of [...r.good, ...r.improve]) expect(b.length).toBeLessThan(110)
  })

  it('judges bodyweight moves on reps, without calling a low count a failure', () => {
    const a = workout('a', '2026-10-27', [['Dip', 3, 0, 5]])
    const b = workout('b', '2026-11-03', [['Dip', 3, 0, 6]])
    const r = reviewWorkout({ session: b, history: [a, b], info, planned: null })!
    expect(r.good[0]).toBe('Beat last time on Dip.')
    expect(r.improve).toEqual([])
  })

  it('flags too many sets for one muscle in one session', () => {
    const b = workout('b', '2026-11-03', [['Barbell Bench Press', 13, 60, 8]])
    expect(reviewWorkout({ session: b, history: [b], info, planned: null })!.improve[0]).toMatch(
      /over 12 sets/,
    )
  })

  it('has nothing to say about an empty workout', () => {
    expect(
      reviewWorkout({ session: workout('x', '2026-11-03', []), history: [], info, planned: null }),
    ).toBeNull()
  })
})
