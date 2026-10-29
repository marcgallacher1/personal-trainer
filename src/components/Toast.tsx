import { useSyncExternalStore } from 'react'

interface ToastData {
  id: number
  message: string
  tone: 'default' | 'celebrate'
  action?: { label: string; onClick: () => void }
}

let current: ToastData | null = null
let seq = 0
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function showToast(t: Omit<ToastData, 'id' | 'tone'> & { tone?: ToastData['tone'] }): void {
  current = { tone: 'default', ...t, id: ++seq }
  clearTimeout(timer)
  // Undo toasts stay long enough to tap; PB celebrations linger a bit; plain confirmations are quick.
  timer = setTimeout(dismiss, t.action ? 5000 : t.tone === 'celebrate' ? 3500 : 1000)
  emit()
}

function dismiss() {
  current = null
  emit()
}

/** Mounted once in the layout. Sits above the tab bar. */
export function ToastHost() {
  const toast = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
  if (!toast) return null
  const celebrate = toast.tone === 'celebrate'
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      <div
        key={toast.id}
        role="status"
        className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-xl ${
          celebrate ? 'animate-[pop_400ms_ease-out] bg-accent text-accent-fg' : 'bg-text text-bg'
        }`}
      >
        {celebrate && <span className="text-2xl">🏆</span>}
        <p className="flex-1 font-medium">{toast.message}</p>
        {toast.action && (
          <button
            type="button"
            className="h-10 shrink-0 rounded-lg px-3 font-semibold underline"
            onClick={() => {
              toast.action?.onClick()
              dismiss()
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  )
}
