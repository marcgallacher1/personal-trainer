import { describe, expect, it } from 'vitest'
import { describePR, detectPRs, formatSeconds, type SetPoint } from './pr'

const w = (
  weight_kg: number,
  reps: number,
  set_type: SetPoint['set_type'] = 'working',
): SetPoint => ({ weight_kg, reps, set_type })

const t = (weight_kg: number, duration_seconds: number): SetPoint => ({
  weight_kg,
  reps: 0,
  duration_seconds,
  set_type: 'working',
})

describe('detectPRs: weight × reps', () => {
  const history = [w(100, 5), w(100, 5), w(95, 8), w(60, 10, 'warmup')]

  it('never celebrates the first exposure', () => {
    expect(detectPRs(w(100, 5), [])).toEqual([])
  })

  it('ignores warm-ups as candidates and as history', () => {
    expect(detectPRs(w(200, 5, 'warmup'), history)).toEqual([])
    expect(detectPRs(w(50, 5), [w(60, 10, 'warmup')])).toEqual([])
  })

  it('flags an e1RM, heaviest-weight and best-at-load PB together', () => {
    // 105×5 → e1RM 122.5 beats 95×8 → 120.3
    const prs = detectPRs(w(105, 5), history)
    expect(prs.map((p) => p.kind)).toEqual(['e1rm', 'weight', 'best_at_load'])
  })

  it('flags reps at a load without an e1RM PB', () => {
    // 90×9 → e1RM 117 (no e1RM PB), but no earlier set was ≥90 kg for ≥9 reps.
    expect(detectPRs(w(90, 9), history)).toEqual([
      { kind: 'best_at_load', logType: 'weight_reps', weight: 90, reps: 9, seconds: 0 },
    ])
  })

  it('does not flag an equal or dominated set', () => {
    expect(detectPRs(w(100, 5), history)).toEqual([])
    expect(detectPRs(w(95, 5), history)).toEqual([])
  })

  it('ignores zero-rep sets', () => {
    expect(detectPRs(w(200, 0), history)).toEqual([])
  })
})

describe('detectPRs: bodyweight × reps', () => {
  it('uses reps at added weight, with no e1RM or heaviest PB', () => {
    const history = [w(0, 12), w(0, 10), w(10, 6)]
    expect(detectPRs(w(0, 13), history, 'bodyweight_reps').map((p) => p.kind)).toEqual([
      'best_at_load',
    ])
    expect(detectPRs(w(10, 7), history, 'bodyweight_reps')).toHaveLength(1)
    expect(detectPRs(w(5, 6), history, 'bodyweight_reps')).toEqual([])
  })
})

describe('detectPRs: assisted', () => {
  const history = [w(30, 8), w(20, 5)]
  it('treats LESS assistance as harder', () => {
    expect(detectPRs(w(20, 6), history, 'assisted_reps')).toHaveLength(1)
    expect(detectPRs(w(15, 3), history, 'assisted_reps')).toHaveLength(1)
    // More assistance for the same reps isn't a PB
    expect(detectPRs(w(40, 8), history, 'assisted_reps')).toEqual([])
  })
})

describe('detectPRs: timed', () => {
  const history = [t(0, 60), t(0, 45), t(10, 30)]
  it('uses time instead of reps', () => {
    expect(detectPRs(t(0, 75), history, 'duration')).toEqual([
      { kind: 'best_at_load', logType: 'duration', weight: 0, reps: 0, seconds: 75 },
    ])
    expect(detectPRs(t(0, 60), history, 'duration')).toEqual([])
    expect(detectPRs(t(0, 0), history, 'duration')).toEqual([])
  })

  it('flags heaviest and longest-at-weight for weight × time', () => {
    const carries = [t(30, 60), t(40, 40)]
    expect(detectPRs(t(45, 30), carries, 'weight_duration').map((p) => p.kind)).toEqual([
      'weight',
      'best_at_load',
    ])
    expect(detectPRs(t(40, 50), carries, 'weight_duration').map((p) => p.kind)).toEqual([
      'best_at_load',
    ])
  })
})

describe('describePR', () => {
  it('formats each kind', () => {
    expect(describePR({ kind: 'e1rm', value: 119.1667, previous: 116.6667 })).toBe(
      'New e1RM: 119.2 kg (was 116.7 kg)',
    )
    expect(describePR({ kind: 'weight', value: 102.5, previous: 100 })).toBe(
      'Heaviest ever: 102.5 kg',
    )
    const b = { kind: 'best_at_load' as const, weight: 0, reps: 0, seconds: 0 }
    expect(describePR({ ...b, logType: 'weight_reps', weight: 90, reps: 9 })).toBe(
      'Best ever at 90 kg: 9 reps',
    )
    expect(describePR({ ...b, logType: 'bodyweight_reps', reps: 13 })).toBe('Most reps ever: 13')
    expect(describePR({ ...b, logType: 'bodyweight_reps', weight: 10, reps: 8 })).toBe(
      'Best ever with +10 kg: 8 reps',
    )
    expect(describePR({ ...b, logType: 'assisted_reps', weight: 20, reps: 6 })).toBe(
      'Best ever with 20 kg assistance: 6 reps',
    )
    expect(describePR({ ...b, logType: 'duration', seconds: 75 })).toBe('Longest ever: 1:15')
    expect(describePR({ ...b, logType: 'weight_duration', weight: 40, seconds: 50 })).toBe(
      'Longest ever at 40 kg: 50 s',
    )
  })
})

describe('formatSeconds', () => {
  it('uses seconds under a minute, m:ss above', () => {
    expect(formatSeconds(45)).toBe('45 s')
    expect(formatSeconds(90)).toBe('1:30')
    expect(formatSeconds(605)).toBe('10:05')
  })
})
