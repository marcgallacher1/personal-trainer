import { describe, expect, it } from 'vitest'
import { labelIndices, linear, niceTicks, shortDate } from './scales'

describe('niceTicks', () => {
  it('picks round steps that cover the data', () => {
    expect(niceTicks(0, 10)).toEqual([0, 2.5, 5, 7.5, 10])
    expect(niceTicks(0, 7)).toEqual([0, 2, 4, 6, 8]) // top tick never below the max
    expect(niceTicks(0, 1)).toEqual([0, 0.25, 0.5, 0.75, 1])
    expect(niceTicks(0, 2600)).toEqual([0, 1000, 2000, 3000])
  })

  it('starts below a non-zero minimum on a round number', () => {
    expect(niceTicks(95, 112)).toEqual([95, 100, 105, 110, 115])
  })

  it('widens a flat range instead of dividing by zero', () => {
    expect(niceTicks(5, 5)).toEqual([4, 4.5, 5, 5.5, 6])
    expect(niceTicks(0, 0)).toEqual([0, 0.25, 0.5, 0.75, 1])
  })
})

describe('linear', () => {
  it('maps a domain onto a (possibly inverted) range', () => {
    const y = linear(0, 10, 100, 0)
    expect(y(0)).toBe(100)
    expect(y(5)).toBe(50)
    expect(y(10)).toBe(0)
  })

  it('returns the middle of the range for an empty domain', () => {
    expect(linear(3, 3, 0, 100)(3)).toBe(50)
  })
})

describe('labelIndices', () => {
  it('labels everything when it fits', () => {
    expect(labelIndices(3, 4)).toEqual([0, 1, 2])
    expect(labelIndices(0)).toEqual([])
  })

  it('spreads labels evenly, always including the first and last', () => {
    expect(labelIndices(10, 4)).toEqual([0, 3, 6, 9])
    expect(labelIndices(12, 5)).toEqual([0, 3, 6, 8, 11])
  })
})

describe('shortDate', () => {
  it('formats YYYY-MM-DD as day and short month', () => {
    expect(shortDate('2026-11-03')).toBe('3 Nov')
    expect(shortDate('2026-01-31')).toBe('31 Jan')
  })
})
