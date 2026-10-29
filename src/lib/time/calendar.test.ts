import { describe, expect, it } from 'vitest'
import { monthGrid, shiftMonth } from './calendar'

describe('monthGrid', () => {
  it('starts weeks on Monday', () => {
    // 1 Oct 2026 is a Thursday
    const g = monthGrid(2026, 10)
    expect(g[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
    expect(g.at(-1)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      null,
    ])
    expect(g).toHaveLength(5)
  })
  it('handles leap Februaries', () => {
    expect(monthGrid(2028, 2).flat().filter(Boolean)).toHaveLength(29)
  })
})

describe('shiftMonth', () => {
  it('wraps years', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
  })
})
