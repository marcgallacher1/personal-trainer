import { describe, expect, it } from 'vitest'
import {
  isoWeekday,
  nextInRotation,
  sessionsForWeekday,
  weekProgress,
  weekStart,
  type WorkoutRef,
} from './schedule'

const sessions = [
  { id: 'pushA', order: 0 },
  { id: 'pullA', order: 1 },
  { id: 'pushB', order: 2 },
  { id: 'pullB', order: 3 },
]
const w = (plan_session_id: string | null, started_at: string, active = true): WorkoutRef => ({
  plan_session_id,
  started_at,
  day: started_at.slice(0, 10),
  active,
})

describe('nextInRotation', () => {
  it('starts at the first session with no history', () => {
    expect(nextInRotation(sessions, [])?.id).toBe('pushA')
  })

  it('follows the most recent plan workout and wraps round', () => {
    expect(nextInRotation(sessions, [w('pushA', '2026-10-27T18:00:00Z')])?.id).toBe('pullA')
    expect(
      nextInRotation(sessions, [
        w('pushB', '2026-10-25T18:00:00Z'),
        w('pullB', '2026-10-28T18:00:00Z'),
      ])?.id,
    ).toBe('pushA')
  })

  it('ignores empty workouts and ones not from this plan', () => {
    expect(
      nextInRotation(sessions, [
        w('pushA', '2026-10-27T18:00:00Z'),
        w('pullA', '2026-10-28T18:00:00Z', false),
        w(null, '2026-10-29T18:00:00Z'),
        w('other-plan', '2026-10-29T19:00:00Z'),
      ])?.id,
    ).toBe('pullA')
  })

  it('returns null for a plan with no sessions', () => {
    expect(nextInRotation([], [])).toBeNull()
  })
})

describe('sessionsForWeekday', () => {
  it('returns sessions assigned to that weekday', () => {
    const schedule = [
      { plan_session_id: 'pushA', weekday: 1 },
      { plan_session_id: 'pullA', weekday: 2 },
      { plan_session_id: 'pushB', weekday: 1 },
    ]
    expect(sessionsForWeekday(sessions, schedule, 1).map((s) => s.id)).toEqual(['pushA', 'pushB'])
    expect(sessionsForWeekday(sessions, schedule, 7)).toEqual([])
  })
})

describe('weeks', () => {
  it('finds ISO weekdays and Monday starts', () => {
    expect(isoWeekday('2026-10-26')).toBe(1) // Monday
    expect(isoWeekday('2026-11-01')).toBe(7) // Sunday
    expect(weekStart('2026-11-01')).toBe('2026-10-26')
    expect(weekStart('2026-10-26')).toBe('2026-10-26')
    expect(weekStart('2027-01-01')).toBe('2026-12-28') // across a year boundary
  })

  it('counts active workouts this week against the target', () => {
    const workouts = [
      w('pushA', '2026-10-25T10:00:00Z'), // previous Sunday — not counted
      w('pushA', '2026-10-26T18:00:00Z'),
      w('pullA', '2026-10-28T18:00:00Z'),
      w('pullB', '2026-10-29T18:00:00Z', false), // nothing logged
    ]
    expect(weekProgress(workouts, '2026-10-29', 4)).toEqual({
      done: 2,
      target: 4,
      days: ['2026-10-26', '2026-10-28'],
    })
  })
})
