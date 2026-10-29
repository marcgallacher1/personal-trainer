import { describe, expect, it } from 'vitest'
import { seedExerciseId } from './seed-ids'

describe('seedExerciseId', () => {
  it('is a stable, case-insensitive v5 UUID', () => {
    const id = seedExerciseId('Barbell Bench Press')
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(seedExerciseId('barbell bench press')).toBe(id)
    expect(seedExerciseId('Deadlift')).not.toBe(id)
  })
})
