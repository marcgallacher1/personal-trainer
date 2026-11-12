import { describe, expect, it } from 'vitest'
import type { ExerciseInfo } from '../analysis/training'
import { EXERCISES } from '../seed/exercises'
import { suggestWorkout, weekDone, type SuggestSession, type SuggestWorkout } from './suggest'

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

// Like the user's week: Mon chest/delts/triceps, Tue back/biceps, Thu legs
const PUSH: SuggestWorkout = {
  id: 'push',
  name: 'Chest, Delts & Triceps',
  days: [1],
  exerciseIds: ['Barbell Bench Press', 'Cable Lateral Raise', 'Rope Pushdown', 'Dumbbell Shrug'],
}
const PULL: SuggestWorkout = {
  id: 'pull',
  name: 'Back & Biceps',
  days: [2],
  exerciseIds: ['Lat Pulldown', 'Barbell Row', 'Dumbbell Curl'],
}
const LEGS: SuggestWorkout = {
  id: 'legs',
  name: 'Legs',
  days: [4],
  exerciseIds: ['Barbell Back Squat', 'Romanian Deadlift', 'Leg Extension'],
}
const plan = [PUSH, PULL, LEGS]

const did = (date: string, w: SuggestWorkout): SuggestSession => ({
  date,
  workoutId: w.id,
  sets: w.exerciseIds.flatMap((exerciseId) =>
    Array.from({ length: 4 }, () => ({ exerciseId, setType: 'working' })),
  ),
})

const suggest = (today: string, sessions: SuggestSession[]) =>
  suggestWorkout({
    today,
    workouts: plan,
    sessions,
    info,
    muscleName: (id) => id.replace('_', ' '),
  })

// 2026-11-02 is a Monday
describe('suggested workout', () => {
  it('suggests what’s planned for today on a normal day', () => {
    expect(suggest('2026-11-02', [])).toEqual({ workoutId: 'push', why: 'Planned for today' })
  })

  it('suggests a missed workout first', () => {
    // Tue, Monday's push was missed
    expect(suggest('2026-11-03', [])?.workoutId).toBe('push')
    expect(suggest('2026-11-03', [])?.why).toMatch(/^Missed on Mon/)
  })

  it('after doing Monday’s push on Tuesday, suggests back and biceps on Wednesday', () => {
    const r = suggest('2026-11-04', [did('2026-11-03', PUSH)])
    expect(r?.workoutId).toBe('pull')
    expect(r?.why).toMatch(/^Missed on Tue/)
  })

  it('steers away from muscles trained yesterday, even if they’re on the calendar', () => {
    // A second chest day on Wed; chest was done Tue (late), so do back first
    const PUSH2 = { ...PUSH, id: 'push2', name: 'Chest B', days: [3] }
    const PULL2 = { ...PULL, days: [4] }
    const r = suggestWorkout({
      today: '2026-11-04',
      workouts: [PUSH, PUSH2, PULL2],
      sessions: [did('2026-11-03', PUSH)],
      info,
      muscleName: (id) => id,
    })
    expect(r?.workoutId).toBe('pull')
    expect(r?.why).toMatch(/^Chest and side_delts worked recently/)
  })

  it('ticks off a plan workout when a custom one trained its muscles', () => {
    // Tue: chest, delts and triceps done as a custom workout (other exercises, no plan link)
    const custom: SuggestSession = {
      date: '2026-11-03',
      workoutId: null,
      sets: ['Incline Dumbbell Press', 'Dumbbell Lateral Raise', 'Straight-Bar Pushdown'].flatMap(
        (exerciseId) => Array.from({ length: 3 }, () => ({ exerciseId, setType: 'working' })),
      ),
    }
    const done = weekDone({ today: '2026-11-04', workouts: plan, sessions: [custom], info })
    expect([...done]).toEqual([['push', 1]])
    // So Wednesday moves on to back and biceps
    expect(suggest('2026-11-04', [custom])?.workoutId).toBe('pull')
  })

  it('doesn’t tick off a workout from a few stray sets', () => {
    const stray: SuggestSession = {
      date: '2026-11-03',
      workoutId: null,
      sets: [{ exerciseId: 'Dumbbell Curl', setType: 'working' }],
    }
    expect(weekDone({ today: '2026-11-04', workouts: plan, sessions: [stray], info }).size).toBe(0)
  })

  it('returns nothing once the week’s plan is done', () => {
    expect(
      suggest('2026-11-06', [
        did('2026-11-02', PUSH),
        did('2026-11-03', PULL),
        did('2026-11-05', LEGS),
      ]),
    ).toBeNull()
  })
})
