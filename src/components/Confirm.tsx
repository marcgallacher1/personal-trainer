import { Button } from './Button'

interface Props {
  open: boolean
  title: string
  body?: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function Confirm({ open, title, body, confirmLabel, onConfirm, onCancel }: Props) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-safe"
      role="alertdialog"
      aria-modal
    >
      <button
        type="button"
        aria-label="Cancel"
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      <div className="relative mb-4 w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl">
        <h2 className="text-lg font-bold">{title}</h2>
        {body && <p className="mt-1 text-muted">{body}</p>}
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
