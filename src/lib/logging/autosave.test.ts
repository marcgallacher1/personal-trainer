import { describe, expect, it } from 'vitest'
import { autoSaveAt } from './autosave'

const NOW = Date.parse('2026-11-12T20:00:00Z')
const live = { ended_at: null }

describe('auto-save', () => {
  it('saves a live workout 30 minutes after the last thing logged, ending then', () => {
    const logged = ['2026-11-12T19:05:00Z', '2026-11-12T19:20:00Z']
    expect(autoSaveAt(live, logged, NOW)).toBe('2026-11-12T19:20:00Z')
  })

  it('leaves it running while you’re still logging', () => {
    expect(autoSaveAt(live, ['2026-11-12T19:45:00Z'], NOW)).toBeNull()
  })

  it('never saves an empty workout, or one that’s already saved', () => {
    expect(autoSaveAt(live, [], NOW)).toBeNull()
    expect(
      autoSaveAt({ ended_at: '2026-11-12T19:30:00Z' }, ['2026-11-12T19:00:00Z'], NOW),
    ).toBeNull()
  })
})
