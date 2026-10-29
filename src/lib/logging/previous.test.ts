import { describe, expect, it } from 'vitest'
import { nextDraft, previousPerformance, remainingDrafts } from './previous'
import type { LoggedSet } from './types'

let n = 0
function set(
  session_id: string,
  order: number,
  weight_kg: number,
  reps: number,
  completed_at: string,
  extra: Partial<LoggedSet> = {},
): LoggedSet {
  return {
    id: `s${++n}`,
    session_id,
    order,
    weight_kg,
    reps,
    rir: null,
    set_type: 'working',
    completed_at,
    deleted_at: null,
    ...extra,
  }
}

const older = [
  set('A', 0, 70, 10, '2026-10-01T18:00:00Z'),
  set('A', 1, 70, 9, '2026-10-01T18:05:00Z'),
]
const latest = [
  set('B', 0, 40, 10, '2026-10-08T18:00:00Z', { set_type: 'warmup' }),
  set('B', 1, 80, 8, '2026-10-08T18:04:00Z'),
  set('B', 2, 80, 7, '2026-10-08T18:08:00Z'),
  set('B', 3, 80, 6, '2026-10-08T18:12:00Z', { deleted_at: '2026-10-08T18:13:00Z' }),
]
const today = [set('C', 0, 40, 10, '2026-10-15T18:00:00Z', { set_type: 'warmup' })]

describe('previousPerformance', () => {
  it('returns the latest other session, in order, without deleted sets', () => {
    const p = previousPerformance([...older, ...latest, ...today], 'C')
    expect(p?.sessionId).toBe('B')
    expect(p?.sets.map((s) => [s.weight_kg, s.reps])).toEqual([
      [40, 10],
      [80, 8],
      [80, 7],
    ])
    expect(p?.date).toBe('2026-10-08T18:08:00Z')
  })

  it('returns null with no history', () => {
    expect(previousPerformance(today, 'C')).toBeNull()
  })
})

describe('remainingDrafts', () => {
  const prev = previousPerformance([...older, ...latest], 'C')

  it('offers the sets not yet repeated today', () => {
    expect(remainingDrafts(prev, today)).toEqual([
      { weight_kg: 80, reps: 8, set_type: 'working' },
      { weight_kg: 80, reps: 7, set_type: 'working' },
    ])
  })

  it('is empty once you have matched the set count, or with no history', () => {
    expect(remainingDrafts(prev, [...today, today[0]!, today[0]!])).toEqual([])
    expect(remainingDrafts(null, [])).toEqual([])
  })
})

describe('nextDraft', () => {
  const prev = previousPerformance([...older, ...latest], 'C')

  it("repeats today's last set", () => {
    const t = [...today, set('C', 1, 82.5, 8, '2026-10-15T18:05:00Z')]
    expect(nextDraft(prev, t)).toEqual({ weight_kg: 82.5, reps: 8, set_type: 'working' })
  })

  it("falls back to last time's first working set, then blank", () => {
    expect(nextDraft(prev, [])).toEqual({ weight_kg: 80, reps: 8, set_type: 'working' })
    expect(nextDraft(null, [])).toEqual({ weight_kg: 0, reps: 0, set_type: 'working' })
  })
})
