import { describe, expect, it } from 'vitest'
import {
  QUICK_FOODS,
  dailyProtein,
  daysHit,
  foodLabel,
  foodProtein,
  proteinTarget,
  weightChange,
  weightTrend,
} from './nutrition'

const food = (id: string) => QUICK_FOODS.find((f) => f.id === id)!

describe('protein target', () => {
  it('is bodyweight × g/kg, 1.8 by default', () => {
    expect(proteinTarget(80, 1.8)).toBe(144)
    expect(proteinTarget(80, null)).toBe(144)
    expect(proteinTarget(null, 1.8)).toBeNull()
  })
})

describe('quick foods', () => {
  it('works out protein from the amount', () => {
    expect(foodProtein(food('shake'), 0)).toBe(35)
    expect(foodProtein(food('chicken'), 150)).toBe(47)
    expect(foodProtein(food('eggs'), 3)).toBe(18)
    expect(foodProtein(food('bacon'), 4)).toBe(20)
  })

  it('labels entries so the list makes sense later', () => {
    expect(foodLabel(food('chicken'), 200)).toBe('Chicken (200 g cooked)')
    expect(foodLabel(food('eggs'), 2)).toBe('Eggs (2)')
    expect(foodLabel(food('shake'), 0)).toBe('Shake')
  })
})

describe('daily protein', () => {
  const entries = [
    { date: '2026-11-02', grams: 35 },
    { date: '2026-11-02', grams: 110 },
    { date: '2026-11-04', grams: 90 },
  ]

  it('totals each day, with empty days as 0', () => {
    expect(dailyProtein(entries, '2026-11-02', '2026-11-04')).toEqual([
      { date: '2026-11-02', grams: 145 },
      { date: '2026-11-03', grams: 0 },
      { date: '2026-11-04', grams: 90 },
    ])
  })

  it('counts days hit out of days logged', () => {
    const days = dailyProtein(entries, '2026-11-02', '2026-11-04')
    expect(daysHit(days, 144)).toEqual({ hit: 1, logged: 2 })
    expect(daysHit(days, null)).toEqual({ hit: 0, logged: 2 })
  })
})

describe('weight trend', () => {
  const weighIns = [
    { date: '2026-10-05', kg: 82 },
    { date: '2026-10-12', kg: 81.6 },
    { date: '2026-10-14', kg: 81 },
    { date: '2026-11-02', kg: 80.4 },
  ]

  it('averages weigh-ins within the last 7 days', () => {
    expect(weightTrend(weighIns).map((w) => w.avg)).toEqual([82, 81.6, 81.3, 80.4])
  })

  it('reports the change over a period', () => {
    expect(weightChange(weighIns, 28)).toEqual({ kg: -1.6, from: '2026-10-05', full: true })
    // Not a year of data yet: compare with the first weigh-in
    expect(weightChange(weighIns, 365)).toEqual({ kg: -1.6, from: '2026-10-05', full: false })
    expect(weightChange([{ date: '2026-11-02', kg: 80 }], 28)).toBeNull()
    expect(weightChange([], 28)).toBeNull()
  })
})
