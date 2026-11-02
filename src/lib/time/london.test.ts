import { describe, expect, it } from 'vitest'
import { londonToIso } from './london'

describe('londonToIso', () => {
  it('handles GMT and BST, including the clock-change days', () => {
    expect(londonToIso('2026-01-15', '18:30')).toBe('2026-01-15T18:30:00.000Z')
    expect(londonToIso('2026-07-15', '18:30')).toBe('2026-07-15T17:30:00.000Z')
    expect(londonToIso('2026-03-29', '12:00')).toBe('2026-03-29T11:00:00.000Z') // BST starts
    expect(londonToIso('2026-10-25', '12:00')).toBe('2026-10-25T12:00:00.000Z') // GMT again
    expect(londonToIso('2026-07-15', '00:15')).toBe('2026-07-14T23:15:00.000Z')
  })
})
