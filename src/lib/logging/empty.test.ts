import { describe, expect, it } from 'vitest'
import { isAbandoned, isEmptyWorkout } from './empty'

const NOW = Date.parse('2026-11-05T12:00:00Z')

describe('empty workouts', () => {
  it('is empty with no sets, cardio or notes', () => {
    expect(isEmptyWorkout({ notes: null, sets: 0, cardio: 0 })).toBe(true)
    expect(isEmptyWorkout({ notes: '  ', sets: 0, cardio: 0 })).toBe(true)
    expect(isEmptyWorkout({ notes: null, sets: 1, cardio: 0 })).toBe(false)
    expect(isEmptyWorkout({ notes: null, sets: 0, cardio: 1 })).toBe(false)
    expect(isEmptyWorkout({ notes: 'Gym was shut', sets: 0, cardio: 0 })).toBe(false)
  })

  it('only tidies away empty workouts over 12 hours old', () => {
    const empty = { notes: null, sets: 0, cardio: 0 }
    expect(isAbandoned({ ...empty, created_at: '2026-11-04T23:00:00Z' }, NOW)).toBe(true)
    expect(isAbandoned({ ...empty, created_at: '2026-11-05T08:00:00Z' }, NOW)).toBe(false)
    expect(isAbandoned({ ...empty, sets: 3, created_at: '2026-11-01T08:00:00Z' }, NOW)).toBe(false)
  })
})
