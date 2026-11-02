import { describe, expect, it } from 'vitest'
import { deletion, localKey, restoration, withLocalKey } from './write'

describe('local keys', () => {
  it('uses the id for ordinary tables', () => {
    expect(localKey('sets', { id: 'abc', session_id: 's' })).toBe('abc')
    expect(withLocalKey('sets', { id: 'abc' })).toEqual({ id: 'abc' })
  })

  it('joins composite primary keys, matching what the outbox and pull compare', () => {
    const mapping = { exercise_id: 'ex1', muscle_id: 'biceps', weight: 1 }
    expect(localKey('exercise_muscles', mapping)).toBe('ex1|biceps')
    expect(withLocalKey('exercise_muscles', mapping)).toEqual({ ...mapping, key: 'ex1|biceps' })

    const target = { user_id: 'u1', muscle_id: 'lats', min_sets: 10 }
    expect(localKey('muscle_targets', target)).toBe('u1|lats')
    expect(withLocalKey('muscle_targets', target).key).toBe('u1|lats')
  })
})

describe('soft deletes', () => {
  it('stamps deleted_at, and undo clears it, leaving the rest of the row alone', () => {
    const row = { id: 'abc', reps: 8, deleted_at: null }
    const del = deletion('sets', row)
    expect(del.table).toBe('sets')
    expect(del.row).toMatchObject({ id: 'abc', reps: 8 })
    expect(typeof del.row.deleted_at).toBe('string')
    expect(restoration('sets', del.row)).toEqual({ table: 'sets', row })
  })
})
