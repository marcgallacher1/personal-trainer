import { describe, expect, it } from 'vitest'
import { bestSide, setTonnage, sides } from './load'
import { formatSet } from './logTypes'

const set = (w: number, r: number, rw: number | null = null, rr: number | null = null) => ({
  weight_kg: w,
  reps: r,
  right_weight_kg: rw,
  right_reps: rr,
  duration_seconds: null,
})

describe('load modes', () => {
  it('counts the bar weight you typed as the total', () => {
    expect(setTonnage(set(60, 10), 'total')).toBe(600)
  })

  it('doubles two dumbbells: 20 kg each × 10 = 400 kg moved', () => {
    expect(setTonnage(set(20, 10), 'per_hand')).toBe(400)
    expect(formatSet(set(20, 10), 'weight_reps', 'per_hand')).toBe('20 kg each × 10')
  })

  it('adds left and right for single-arm sets', () => {
    const s = set(14, 10, 14, 8)
    expect(sides(s)).toEqual([
      { weightKg: 14, reps: 10 },
      { weightKg: 14, reps: 8 },
    ])
    expect(setTonnage(s, 'per_side')).toBe(14 * 18)
    expect(formatSet(s, 'weight_reps', 'per_side')).toBe('14 kg × L10 R8')
    expect(formatSet(set(14, 10, 12, 10), 'weight_reps', 'per_side')).toBe('14 / 12 kg × L10 R10')
  })

  it('treats an old single-arm set with one entry as both arms', () => {
    expect(setTonnage(set(14, 10), 'per_side')).toBe(280)
  })

  it('uses the stronger side for PBs', () => {
    expect(bestSide(set(14, 10, 14, 8))).toEqual({ weightKg: 14, reps: 10 })
    expect(bestSide(set(12, 10, 14, 10))).toEqual({ weightKg: 14, reps: 10 })
  })
})
