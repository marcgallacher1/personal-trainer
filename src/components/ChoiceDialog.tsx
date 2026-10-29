interface Choice {
  label: string
  description?: string
  tone?: 'primary' | 'danger' | 'default'
  onSelect: () => void
}

interface Props {
  open: boolean
  title: string
  body?: string
  choices: Choice[]
  onCancel: () => void
}

/** A bottom dialog offering several labelled choices plus Cancel. */
export function ChoiceDialog({ open, title, body, choices, onCancel }: Props) {
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
      <div className="relative mb-4 flex w-full max-w-md flex-col gap-2 rounded-2xl bg-surface p-5 shadow-2xl">
        <h2 className="text-lg font-bold">{title}</h2>
        {body && <p className="text-muted">{body}</p>}
        <div className="mt-2 flex flex-col gap-2">
          {choices.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.onSelect}
              className={`flex min-h-14 flex-col justify-center rounded-xl px-4 py-2 text-left ${
                c.tone === 'primary'
                  ? 'bg-accent text-accent-fg'
                  : c.tone === 'danger'
                    ? 'bg-danger/10 text-danger'
                    : 'bg-surface-2'
              }`}
            >
              <span className="font-semibold">{c.label}</span>
              {c.description && <span className="text-xs opacity-80">{c.description}</span>}
            </button>
          ))}
          <button type="button" className="h-12 text-muted" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
