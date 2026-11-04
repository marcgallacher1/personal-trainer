import { describe, expect, it } from 'vitest'
import { clock, restBefore } from './rest'

describe('rest between sets', () => {
  it('takes off a minute for doing the set', () => {
    expect(restBefore('2026-11-03T18:00:00Z', '2026-11-03T18:02:30Z')).toBe(90)
    expect(restBefore('2026-11-03T18:00:00Z', '2026-11-03T18:00:30Z')).toBe(0)
  })

  it('ignores long breaks and bad times', () => {
    expect(restBefore('2026-11-03T18:00:00Z', '2026-11-03T18:20:00Z')).toBeNull()
    expect(restBefore('2026-11-03T18:05:00Z', '2026-11-03T18:00:00Z')).toBeNull()
  })

  it('formats as m:ss', () => {
    expect(clock(65)).toBe('1:05')
    expect(clock(0)).toBe('0:00')
  })
})
