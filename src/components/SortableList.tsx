import { useRef, useState } from 'react'
import { dropIndex, moveItem } from '../lib/ui/reorder'

interface Props<T> {
  items: readonly T[]
  keyOf: (item: T) => string
  /** Show the drag handles */
  enabled: boolean
  render: (item: T, index: number) => React.ReactNode
  /** The new order, once you let go */
  onReorder: (items: T[]) => void
}

const GAP = 8

/** A list you reorder by dragging the ≡ handle (touch or mouse). */
export function SortableList<T>({ items, keyOf, enabled, render, onReorder }: Props<T>) {
  const rows = useRef<(HTMLLIElement | null)[]>([])
  const [drag, setDrag] = useState<{
    from: number
    startY: number
    dy: number
    /** Row heights, measured when the drag starts */
    heights: number[]
  } | null>(null)

  const to = drag ? dropIndex(drag.heights, drag.from, drag.dy) : -1
  const draggedHeight = drag ? (drag.heights[drag.from] ?? 0) : 0

  /** How far a row shifts to make room for the dragged one. */
  const shift = (i: number) => {
    if (!drag || i === drag.from) return 0
    if (drag.from < to && i > drag.from && i <= to) return -draggedHeight
    if (drag.from > to && i < drag.from && i >= to) return draggedHeight
    return 0
  }

  const end = () => {
    if (drag && to !== drag.from) onReorder(moveItem(items, drag.from, to))
    setDrag(null)
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => {
        const dragging = drag?.from === i
        return (
          <li
            key={keyOf(item)}
            ref={(el) => {
              rows.current[i] = el
            }}
            className={`flex items-center gap-2 ${dragging ? 'relative z-10' : ''}`}
            style={{
              transform: `translateY(${dragging ? drag.dy : shift(i)}px)`,
              transition: dragging ? 'none' : 'transform 150ms ease',
            }}
          >
            <div className={`min-w-0 flex-1 ${dragging ? 'scale-[1.02] shadow-xl' : ''}`}>
              {render(item, i)}
            </div>
            {enabled && (
              <button
                type="button"
                aria-label="Drag to reorder"
                className="flex h-14 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl bg-surface text-xl text-muted active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  setDrag({
                    from: i,
                    startY: e.clientY,
                    dy: 0,
                    heights: rows.current.map((el) => (el?.offsetHeight ?? 0) + GAP),
                  })
                }}
                onPointerMove={(e) => setDrag((d) => (d ? { ...d, dy: e.clientY - d.startY } : d))}
                onPointerUp={end}
                onPointerCancel={() => setDrag(null)}
              >
                ≡
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
