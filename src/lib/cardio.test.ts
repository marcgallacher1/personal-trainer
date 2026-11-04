import { describe, expect, it } from 'vitest'
import {
  cardioLeft,
  cardioName,
  cardioSummary,
  cardioTotals,
  describePlannedCardio,
  plannedCardio,
} from './cardio'

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

describe('planned cardio', () => {
  it('reads cardio_json and drops anything malformed', () => {
    expect(
      plannedCardio([
        { activity: 'run', minutes: 20 },
        { activity: 'teleport', minutes: 5 },
        { activity: 'row', minutes: 0 },
        null,
      ]),
    ).toEqual([{ activity: 'run', minutes: 20 }])
    expect(plannedCardio(null)).toEqual([])
  })

  it('describes it in a few words', () => {
    expect(
      describePlannedCardio([
        { activity: 'run', minutes: 20 },
        { activity: 'row', minutes: 10 },
      ]),
    ).toBe('20 min running + 10 min rowing machine')
  })

  it('ticks off what has been logged, one entry each', () => {
    const plan = [
      { activity: 'run', minutes: 10 },
      { activity: 'run', minutes: 10 },
      { activity: 'row', minutes: 5 },
    ] as const
    expect(cardioLeft(plan, [{ activity: 'run' }])).toEqual([
      { activity: 'run', minutes: 10 },
      { activity: 'row', minutes: 5 },
    ])
    expect(cardioLeft(plan, [{ activity: 'cycle' }])).toHaveLength(3)
  })
})
