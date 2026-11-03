import { describe, expect, it } from 'vitest'
import { dropIndex, moveItem } from './reorder'

describe('drag to reorder', () => {
  it('moves an item', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })

  it('passes a neighbour once dragged over half of it', () => {
    const h = [80, 80, 80, 80]
    expect(dropIndex(h, 0, 30)).toBe(0)
    expect(dropIndex(h, 0, 41)).toBe(1)
    expect(dropIndex(h, 0, 130)).toBe(2)
    expect(dropIndex(h, 0, 999)).toBe(3)
    expect(dropIndex(h, 3, -45)).toBe(2)
    expect(dropIndex(h, 3, -999)).toBe(0)
  })
})
