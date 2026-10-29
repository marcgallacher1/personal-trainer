import { describe, expect, it } from 'vitest'
import { asLogType, columnHeadings, formatSet, headlineStats } from './logTypes'

const s = (weight_kg: number, reps: number, duration_seconds: number | null = null) => ({
  weight_kg,
  reps,
  duration_seconds,
})

describe('formatSet', () => {
  it('formats every log type', () => {
    expect(formatSet(s(80, 8), 'weight_reps')).toBe('80 kg × 8')
    expect(formatSet(s(0, 12), 'bodyweight_reps')).toBe('BW × 12')
    expect(formatSet(s(10, 8), 'bodyweight_reps')).toBe('BW +10 kg × 8')
    expect(formatSet(s(20, 8), 'assisted_reps')).toBe('20 kg assist × 8')
    expect(formatSet(s(0, 0, 45), 'duration')).toBe('45 s')
    expect(formatSet(s(10, 0, 60), 'duration')).toBe('1:00 (+10 kg)')
    expect(formatSet(s(40, 0, 60), 'weight_duration')).toBe('40 kg × 1:00')
  })
})

describe('columnHeadings', () => {
  it('names load and effort per type', () => {
    expect(columnHeadings('weight_reps')).toEqual({ load: 'Weight', effort: 'Reps' })
    expect(columnHeadings('assisted_reps')).toEqual({ load: 'Assist', effort: 'Reps' })
    expect(columnHeadings('duration')).toEqual({ load: 'Load', effort: 'Time' })
  })
})

describe('asLogType', () => {
  it('falls back to weight × reps for unknown values', () => {
    expect(asLogType('duration')).toBe('duration')
    expect(asLogType(null)).toBe('weight_reps')
    expect(asLogType('nonsense')).toBe('weight_reps')
  })
})

const w = (
  weight_kg: number,
  reps: number,
  duration_seconds: number | null = null,
  set_type = 'working',
) => ({ weight_kg, reps, duration_seconds, set_type })

describe('headlineStats', () => {
  it('weight × reps: best e1RM and heaviest, ignoring warm-ups', () => {
    expect(headlineStats([w(100, 5), w(110, 1), w(140, 1, null, 'warmup')], 'weight_reps')).toEqual(
      [
        { label: 'Best e1RM (kg)', value: '116.7', detail: '100 kg × 5' },
        { label: 'Heaviest (kg)', value: '110' },
      ],
    )
  })

  it('bodyweight: most reps and heaviest added', () => {
    expect(headlineStats([w(0, 15), w(10, 8)], 'bodyweight_reps')).toEqual([
      { label: 'Most reps', value: '15', detail: 'BW × 15' },
      { label: 'Heaviest added (kg)', value: '10' },
    ])
  })

  it('assisted: least assistance', () => {
    expect(headlineStats([w(30, 8), w(15, 5)], 'assisted_reps')[1]).toEqual({
      label: 'Least assistance (kg)',
      value: '15',
    })
  })

  it('timed: longest hold', () => {
    expect(headlineStats([w(0, 0, 45), w(0, 0, 90)], 'duration')[0]).toEqual({
      label: 'Longest hold',
      value: '1:30',
    })
  })

  it('shows dashes with no history', () => {
    expect(headlineStats([], 'weight_reps').map((tile) => tile.value)).toEqual(['—', '—'])
  })
})
