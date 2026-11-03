import { describe, expect, it } from 'vitest'
import {
  describeTarget,
  describeTargets,
  quickSets,
  withWorkingSets,
  type TargetLike,
} from './targets'

const t = (
  reps_min: number | null,
  reps_max: number | null,
  target_rir: number | null,
  set_type = 'working',
): TargetLike => ({
  set_type,
  reps_min,
  reps_max,
  seconds_min: null,
  seconds_max: null,
  target_rir,
})

describe('describeTarget', () => {
  it('describes reps, RIR and set types', () => {
    expect(describeTarget(t(8, 12, 1), 'weight_reps')).toBe('8–12 reps · near failure')
    expect(describeTarget(t(10, 15, 0), 'weight_reps')).toBe('10–15 reps · to failure')
    expect(describeTarget(t(10, 10, null, 'warmup'), 'weight_reps')).toBe('Warm-up · 10 reps')
    expect(describeTarget(t(null, null, null), 'weight_reps')).toBe('Any')
  })

  it('uses seconds for timed exercises', () => {
    const hold = { ...t(null, null, null), seconds_min: 30, seconds_max: 60 }
    expect(describeTarget(hold, 'duration')).toBe('30 s–1:00')
  })
})

describe('describeTargets', () => {
  it('groups identical working sets and counts warm-ups', () => {
    expect(describeTargets([t(8, 12, 1), t(8, 12, 1), t(8, 12, 1)], 'weight_reps')).toBe(
      '3 × 8–12 reps · near failure',
    )
    expect(
      describeTargets(
        [t(10, 10, null, 'warmup'), t(6, 8, 1), t(10, 12, 0), t(10, 12, 0)],
        'weight_reps',
      ),
    ).toBe('1 warm-up + 1 × 6–8 reps · near failure, 2 × 10–12 reps · to failure')
    expect(describeTargets([], 'weight_reps')).toBe('No sets planned')
  })
})

describe('quickSets', () => {
  it('creates N working targets', () => {
    const sets = quickSets({ sets: 3, min: 8, max: 12, rir: 1 }, 'weight_reps')
    expect(sets).toHaveLength(3)
    expect(sets[0]).toEqual(t(8, 12, 1))
  })

  it('writes seconds for timed exercises', () => {
    expect(quickSets({ sets: 2, min: 30, max: 45, rir: null }, 'duration')[0]).toMatchObject({
      reps_min: null,
      seconds_min: 30,
      seconds_max: 45,
    })
  })
})

describe('withWorkingSets', () => {
  const warm: TargetLike = {
    ...quickSets({ sets: 1, min: 10, max: 10, rir: null }, 'weight_reps')[0]!,
    set_type: 'warmup',
  }
  const work = quickSets({ sets: 3, min: 8, max: 12, rir: 1 }, 'weight_reps')

  it('adds sets by copying the last working set, keeping warm-ups', () => {
    const out = withWorkingSets([warm, ...work], 5)
    expect(out.map((x) => x.set_type)).toEqual([
      'warmup',
      'working',
      'working',
      'working',
      'working',
      'working',
    ])
    expect(out[5]).toEqual(work[2])
  })

  it('removes working sets from the end', () => {
    expect(withWorkingSets([warm, ...work], 2).map((x) => x.set_type)).toEqual([
      'warmup',
      'working',
      'working',
    ])
  })
})
