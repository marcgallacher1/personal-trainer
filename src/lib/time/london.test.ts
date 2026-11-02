import { describe, expect, it } from 'vitest'
import { isoWeek, londonToIso } from './london'

describe('londonToIso', () => {
  it('handles GMT and BST, including the clock-change days', () => {
    expect(londonToIso('2026-01-15', '18:30')).toBe('2026-01-15T18:30:00.000Z')
    expect(londonToIso('2026-07-15', '18:30')).toBe('2026-07-15T17:30:00.000Z')
    expect(londonToIso('2026-03-29', '12:00')).toBe('2026-03-29T11:00:00.000Z') // BST starts
    expect(londonToIso('2026-10-25', '12:00')).toBe('2026-10-25T12:00:00.000Z') // GMT again
    expect(londonToIso('2026-07-15', '00:15')).toBe('2026-07-14T23:15:00.000Z')
  })
})

describe('isoWeek', () => {
  it('numbers weeks from the one with the year’s first Thursday', () => {
    expect(isoWeek('2026-11-02')).toBe('2026-W45')
    expect(isoWeek('2026-11-08')).toBe('2026-W45')
    expect(isoWeek('2026-01-01')).toBe('2026-W01') // a Thursday
    expect(isoWeek('2027-01-01')).toBe('2026-W53') // a Friday, still 2026's last week
    expect(isoWeek('2024-12-30')).toBe('2025-W01')
  })
})
