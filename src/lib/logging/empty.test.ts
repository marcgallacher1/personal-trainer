import { describe, expect, it } from 'vitest'
import { discardOnBack, isAbandoned, isEmptyWorkout } from './empty'

const NOW = Date.parse('2026-11-05T12:00:00Z')

describe('empty workouts', () => {
  it('is empty with no sets, cardio or notes', () => {
    expect(isEmptyWorkout({ notes: null, sets: 0, cardio: 0 })).toBe(true)
    expect(isEmptyWorkout({ notes: '  ', sets: 0, cardio: 0 })).toBe(true)
    expect(isEmptyWorkout({ notes: null, sets: 1, cardio: 0 })).toBe(false)
    expect(isEmptyWorkout({ notes: null, sets: 0, cardio: 1 })).toBe(false)
    expect(isEmptyWorkout({ notes: 'Gym was shut', sets: 0, cardio: 0 })).toBe(false)
  })

  it('keeps a workout you’ve set up when you go Back, but not a blank one', () => {
    const none = { notes: null, sets: 0, cardio: 0 }
    expect(discardOnBack({ ...none, exercises: 0, finished: false })).toBe(true)
    // Exercises chosen, nothing logged yet: still there to resume
    expect(discardOnBack({ ...none, exercises: 4, finished: false })).toBe(false)
    // Renamed or with sets: obviously kept
    expect(discardOnBack({ ...none, sets: 1, exercises: 1, finished: false })).toBe(false)
    // Logged afterwards with nothing in it: nothing to resume
    expect(discardOnBack({ ...none, exercises: 4, finished: true })).toBe(true)
  })

  it('only tidies away empty workouts over 12 hours old', () => {
    const empty = { notes: null, sets: 0, cardio: 0 }
    expect(isAbandoned({ ...empty, created_at: '2026-11-04T23:00:00Z' }, NOW)).toBe(true)
    expect(isAbandoned({ ...empty, created_at: '2026-11-05T08:00:00Z' }, NOW)).toBe(false)
    expect(isAbandoned({ ...empty, sets: 3, created_at: '2026-11-01T08:00:00Z' }, NOW)).toBe(false)
  })
})
