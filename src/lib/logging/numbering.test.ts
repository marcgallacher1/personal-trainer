import { describe, expect, it } from 'vitest'
import { groupLabels } from '../plans/groups'
import { setNumbers } from './numbering'

describe('setNumbers', () => {
  it('numbers every non-warm-up set in order, leaving warm-ups at 0', () => {
    expect(setNumbers(['warmup', 'warmup', 'working', 'working', 'drop', 'failure'])).toEqual([
      0, 0, 1, 2, 3, 4,
    ])
    expect(setNumbers(['working', 'warmup', 'working'])).toEqual([1, 0, 2])
    expect(setNumbers([])).toEqual([])
  })
})

const e = (id: string, group_id: string | null = null) => ({ id, group_id })

describe('groupLabels', () => {
  it('letters groups by first appearance and numbers their members', () => {
    const labels = groupLabels([
      e('press'),
      e('curl', 'g2'),
      e('pushdown', 'g2'),
      e('raise'),
      e('fly', 'g1'),
      e('pulldown', 'g1'),
      e('shrug', 'g1'),
    ])
    expect([...labels]).toEqual([
      ['curl', 'A1'],
      ['pushdown', 'A2'],
      ['fly', 'B1'],
      ['pulldown', 'B2'],
      ['shrug', 'B3'],
    ])
  })

  it('gives ungrouped exercises no label', () => {
    expect(groupLabels([e('a'), e('b')]).size).toBe(0)
  })
})
