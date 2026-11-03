/** Pure helpers for drag-to-reorder lists. */

/** The list with the item at `from` moved to `to`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list]
  const [item] = out.splice(from, 1)
  if (item === undefined) return out
  out.splice(Math.max(0, Math.min(out.length, to)), 0, item)
  return out
}

/**
 * Where a dragged item lands: it passes a neighbour once it's moved over half of it.
 * `heights` are the rows' heights (including the gap), `dy` how far it's been dragged.
 */
export function dropIndex(heights: readonly number[], from: number, dy: number): number {
  let to = from
  let travelled = dy
  if (dy > 0) {
    for (let i = from + 1; i < heights.length; i++) {
      if (travelled < heights[i]! / 2) break
      travelled -= heights[i]!
      to = i
    }
  } else {
    for (let i = from - 1; i >= 0; i--) {
      if (-travelled < heights[i]! / 2) break
      travelled += heights[i]!
      to = i
    }
  }
  return to
}
