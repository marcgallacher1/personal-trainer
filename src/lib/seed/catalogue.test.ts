import { describe, expect, it } from 'vitest'
import { EXERCISES } from './exercises'
import { MUSCLE_IDS, MUSCLES } from './muscles'

describe('seed catalogue', () => {
  it('has the 17 muscle groups, uniquely', () => {
    expect(MUSCLES).toHaveLength(17)
    expect(new Set(MUSCLES.map((m) => m.id)).size).toBe(17)
    expect(MUSCLES.map((m) => m.id)).toEqual([...MUSCLE_IDS])
  })

  it('has roughly 120 exercises with unique names', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(115)
    const names = EXERCISES.map((e) => e.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })

  it('gives every exercise a primary mover and never lists a muscle twice', () => {
    for (const e of EXERCISES) {
      expect(e.primary.length, e.name).toBeGreaterThan(0)
      const all = [...e.primary, ...e.secondary]
      expect(new Set(all).size, e.name).toBe(all.length)
    }
  })

  it('covers every movement pattern and trains every muscle directly', () => {
    const patterns = new Set(EXERCISES.map((e) => e.pattern))
    for (const p of [
      'horizontal_push',
      'vertical_push',
      'horizontal_pull',
      'vertical_pull',
      'squat',
      'hinge',
      'lunge',
      'carry',
      'core',
      'isolation',
    ]) {
      expect(patterns.has(p as never), p).toBe(true)
    }
    const primaries = new Set(EXERCISES.flatMap((e) => e.primary))
    for (const m of MUSCLE_IDS) expect(primaries.has(m), m).toBe(true)
  })
})

describe('log types', () => {
  const byName = new Map(EXERCISES.map((e) => [e.name, e.logType]))

  it('maps every override to a real exercise', () => {
    for (const name of [
      'Plank',
      'Side Plank',
      'Dead Hang',
      'Copenhagen Plank',
      "Farmer's Walk",
      'Suitcase Carry',
      'Trap Bar Carry',
      'Assisted Pull-Up',
      'Ab Wheel Rollout',
      'Glute-Ham Raise',
      'Band Pull-Apart',
    ]) {
      expect(byName.has(name), name).toBe(true)
    }
  })

  it('assigns sensible types', () => {
    expect(byName.get('Ab Wheel Rollout')).toBe('bodyweight_reps')
    expect(byName.get('Dip')).toBe('bodyweight_reps')
    expect(byName.get('Plank')).toBe('duration')
    expect(byName.get("Farmer's Walk")).toBe('weight_duration')
    expect(byName.get('Assisted Pull-Up')).toBe('assisted_reps')
    expect(byName.get('Barbell Bench Press')).toBe('weight_reps')
    expect(byName.get('Cable Crunch')).toBe('weight_reps')
  })
})
