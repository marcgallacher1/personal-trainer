import { describe, expect, it } from 'vitest'
import { e1rm, volumeLoad } from './e1rm'

describe('e1rm', () => {
  it('uses Epley', () => {
    expect(e1rm(100, 5)).toBeCloseTo(116.667, 3)
    expect(e1rm(80, 10)).toBeCloseTo(106.667, 3)
  })
  it('returns the weight itself for a single', () => {
    expect(e1rm(140, 1)).toBe(140)
  })
  it('caps at 12 reps', () => {
    expect(e1rm(60, 12)).toBeCloseTo(84, 5)
    expect(e1rm(60, 13)).toBeNull()
  })
  it('rejects zero weight or reps', () => {
    expect(e1rm(0, 5)).toBeNull()
    expect(e1rm(100, 0)).toBeNull()
  })
})

describe('volumeLoad', () => {
  it('multiplies weight by reps', () => {
    expect(volumeLoad(100, 5)).toBe(500)
    expect(volumeLoad(0, 12)).toBe(0)
  })
})
