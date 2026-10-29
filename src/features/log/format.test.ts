import { describe, expect, it } from 'vitest'
import { formatDuration, londonDate, sessionTitle } from './format'

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration('2026-10-29T18:00:00Z', '2026-10-29T18:42:10Z')).toBe('42 min')
    expect(formatDuration('2026-10-29T18:00:00Z', '2026-10-29T19:05:00Z')).toBe('1 h 05 min')
  })
  it('measures open sessions to now', () => {
    expect(formatDuration('2026-10-29T18:00:00Z', null, Date.parse('2026-10-29T18:10:00Z'))).toBe(
      '10 min',
    )
  })
})

describe('sessionTitle', () => {
  it('uses the name when set', () => {
    expect(sessionTitle({ name: 'Push A', started_at: '2026-10-29T18:00:00Z' })).toBe('Push A')
  })
  it('derives a London-time title', () => {
    // 29 Oct 2026 is after the clocks go back, so London = UTC
    expect(sessionTitle({ name: null, started_at: '2026-10-29T18:00:00Z' })).toBe(
      'Thu evening workout',
    )
    // Summer time: 11:30 UTC = 12:30 BST → afternoon
    expect(sessionTitle({ name: null, started_at: '2026-07-01T11:30:00Z' })).toBe(
      'Wed afternoon workout',
    )
  })
})

describe('londonDate', () => {
  it('uses the London calendar day, not UTC', () => {
    // 23:30 UTC on 30 June = 00:30 BST on 1 July
    expect(londonDate('2026-06-30T23:30:00Z')).toBe('2026-07-01')
    expect(londonDate('2026-12-31T23:30:00Z')).toBe('2026-12-31')
  })
})
