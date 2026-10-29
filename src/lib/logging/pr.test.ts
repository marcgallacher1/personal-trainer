import { describe, expect, it } from 'vitest'
import { describePR, detectPRs, type SetPoint } from './pr'

const w = (
  weight_kg: number,
  reps: number,
  set_type: SetPoint['set_type'] = 'working',
): SetPoint => ({
  weight_kg,
  reps,
  set_type,
})

describe('detectPRs', () => {
  const history = [w(100, 5), w(100, 5), w(95, 8), w(60, 10, 'warmup')]

  it('never celebrates the first exposure', () => {
    expect(detectPRs(w(100, 5), [])).toEqual([])
  })

  it('ignores warm-ups as candidates and as history', () => {
    expect(detectPRs(w(200, 5, 'warmup'), history)).toEqual([])
    // Only a warm-up before → still a first exposure
    expect(detectPRs(w(50, 5), [w(60, 10, 'warmup')])).toEqual([])
  })

  it('flags an e1RM, heaviest-weight and rep PR together', () => {
    // 105×5 → e1RM 122.5 beats 95×8 → 120.3
    const prs = detectPRs(w(105, 5), history)
    expect(prs.map((p) => p.kind)).toEqual(['e1rm', 'weight', 'reps_at_weight'])
  })

  it('flags reps at a weight without an e1RM PR', () => {
    // 90×9 → e1RM 117 (no e1RM PR), but no earlier set was ≥90 kg for ≥9 reps.
    const prs = detectPRs(w(90, 9), history)
    expect(prs).toEqual([{ kind: 'reps_at_weight', weight: 90, reps: 9 }])
  })

  it('does not flag an equal or dominated set', () => {
    expect(detectPRs(w(100, 5), history)).toEqual([])
    expect(detectPRs(w(95, 5), history)).toEqual([])
  })

  it('handles bodyweight movements (0 kg) via reps', () => {
    const prs = detectPRs(w(0, 13), [w(0, 12), w(0, 10)])
    expect(prs).toEqual([{ kind: 'reps_at_weight', weight: 0, reps: 13 }])
  })

  it('ignores zero-rep sets', () => {
    expect(detectPRs(w(200, 0), history)).toEqual([])
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
    expect(describePR({ kind: 'reps_at_weight', weight: 90, reps: 9 })).toBe(
      'Best ever at 90 kg: 9 reps',
    )
    expect(describePR({ kind: 'reps_at_weight', weight: 0, reps: 13 })).toBe('Most reps ever: 13')
  })
})
