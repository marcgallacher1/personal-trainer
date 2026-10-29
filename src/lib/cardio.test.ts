import { describe, expect, it } from 'vitest'
import { cardioName, cardioSummary, cardioTotals } from './cardio'

const entry = {
  activity: 'run',
  duration_seconds: 1200,
  calories: 250,
  distance_km: 3.2,
  avg_hr: 142,
}

describe('cardioSummary', () => {
  it('includes every recorded metric', () => {
    expect(cardioSummary(entry)).toBe('20 min · 250 kcal · 3.2 km · 142 bpm')
  })
  it('omits optional metrics that were not recorded', () => {
    expect(cardioSummary({ ...entry, calories: null, distance_km: null, avg_hr: null })).toBe(
      '20 min',
    )
  })
})

describe('cardioTotals', () => {
  it('sums minutes and calories, treating missing calories as 0', () => {
    expect(cardioTotals([entry, { ...entry, duration_seconds: 600, calories: null }])).toEqual({
      minutes: 30,
      calories: 250,
    })
    expect(cardioTotals([])).toEqual({ minutes: 0, calories: 0 })
  })
})

describe('cardioName', () => {
  it('labels known and unknown activities', () => {
    expect(cardioName('stairs')).toBe('Stair climber')
    expect(cardioName('elliptical')).toBe('Cross-trainer')
    expect(cardioName('parkour')).toBe('parkour')
  })
})
