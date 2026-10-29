import { useEffect, type ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** Bottom sheet that fills most of the screen; reachable with one thumb. */
export function Sheet({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end"
      role="dialog"
      aria-modal
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative flex max-h-[88%] flex-col rounded-t-3xl bg-bg pb-safe shadow-2xl">
        <div className="flex items-center justify-between px-safe pt-4 pb-2">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" className="h-11 px-3 text-accent" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-safe pb-4">{children}</div>
      </div>
    </div>
  )
}
