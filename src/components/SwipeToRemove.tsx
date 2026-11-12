import { useRef, useState } from 'react'

/** How far left (px) a swipe has to go to remove the row */
const REMOVE_AT = 90

/**
 * Swipe a row left to remove it. Vertical drags still scroll the page, and a tap still reaches
 * whatever is inside.
 */
export function SwipeToRemove({
  enabled = true,
  label = 'Remove',
  onRemove,
  children,
}: {
  enabled?: boolean
  /** Shown behind the row as it slides */
  label?: string
  onRemove: () => void
  children: React.ReactNode
}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  /** True once the gesture is clearly sideways, so the tap that ends it is ignored */
  const swiped = useRef(false)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)

  if (!enabled) return <>{children}</>

  const end = (remove: boolean) => {
    start.current = null
    setDragging(false)
    setDx(0)
    if (remove) onRemove()
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {dx < 0 && (
        <div
          aria-hidden
          className={`absolute inset-0 flex items-center justify-end rounded-2xl px-5 font-bold text-white ${
            dx <= -REMOVE_AT ? 'bg-danger' : 'bg-danger/60'
          }`}
        >
          {label}
        </div>
      )}
      <div
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? 'none' : 'transform 150ms ease-out',
          // Up and down still scrolls; sideways is ours
          touchAction: 'pan-y',
        }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY }
          swiped.current = false
        }}
        onPointerMove={(e) => {
          if (!start.current) return
          const moveX = e.clientX - start.current.x
          const moveY = e.clientY - start.current.y
          if (!swiped.current) {
            // Wait until it's clearly a sideways swipe, not a scroll or a wobbly tap
            if (Math.abs(moveX) < 10 || Math.abs(moveX) < Math.abs(moveY)) return
            swiped.current = true
            setDragging(true)
            e.currentTarget.setPointerCapture(e.pointerId)
          }
          setDx(Math.min(0, moveX))
        }}
        onPointerUp={() => {
          if (start.current) end(dx <= -REMOVE_AT)
        }}
        onPointerCancel={() => end(false)}
        onClickCapture={(e) => {
          if (!swiped.current) return
          // The swipe's own "click" shouldn't open the row
          e.stopPropagation()
          e.preventDefault()
          swiped.current = false
        }}
      >
        {children}
      </div>
    </div>
  )
}
