import { useEffect, type ReactNode, type Ref } from 'react'

interface Props {
  open: boolean
  /** Ref to the scrolling body, e.g. to scroll back to the top */
  bodyRef?: Ref<HTMLDivElement>

  title: string
  /** Optional line under the title */
  subtitle?: ReactNode
  onClose: () => void
  /** Label for the top-right close button */
  closeLabel?: string
  /** Pinned below the scrolling content (e.g. a primary action) */
  footer?: ReactNode
  children: ReactNode
}

/** Full-height modal with a scrolling body and optional pinned footer. */
export function Sheet({
  open,
  bodyRef,
  title,
  subtitle,
  onClose,
  closeLabel = 'Done',
  footer,
  children,
}: Props) {
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
    <div className="fixed inset-0 z-40 flex flex-col" role="dialog" aria-modal aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="relative mt-[calc(env(safe-area-inset-top)+0.5rem)] flex min-h-0 flex-1 animate-[slideup_220ms_ease-out] flex-col rounded-t-3xl bg-bg shadow-2xl">
        <div className="flex items-start gap-3 border-b border-border px-safe pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-bold">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
          </div>
          <button
            type="button"
            className="h-10 shrink-0 rounded-full bg-surface px-4 font-semibold text-accent"
            onClick={onClose}
          >
            {closeLabel}
          </button>
        </div>
        <div
          ref={bodyRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-safe py-4"
        >
          {children}
        </div>
        {footer && (
          <div className="border-t border-border px-safe pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
