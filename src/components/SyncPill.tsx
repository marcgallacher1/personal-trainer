import { useState } from 'react'
import { useOutboxCount } from '../db/queries'
import { syncNow, useSyncState } from '../db/syncController'

/** Small status pill: Synced / Saving N / Offline (N saved on phone) / Sync error. Tap to retry. */
export function SyncPill() {
  const { status, error } = useSyncState()
  const pending = useOutboxCount() ?? 0
  const [showError, setShowError] = useState(false)

  let label: string
  let dot: string
  if (status === 'offline') {
    label = pending ? `Offline · ${pending} saved on phone` : 'Offline'
    dot = 'bg-muted'
  } else if (status === 'error') {
    label = pending ? `Sync error · ${pending} waiting` : 'Sync error'
    dot = 'bg-danger'
  } else if (status === 'syncing' || pending > 0) {
    label = pending ? `Syncing ${pending}…` : 'Syncing…'
    dot = 'bg-accent animate-pulse'
  } else {
    label = 'Synced'
    dot = 'bg-success'
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="flex h-8 items-center gap-2 rounded-full bg-surface px-3 text-xs text-muted"
        onClick={() => {
          if (status === 'error') setShowError((v) => !v)
          void syncNow()
        }}
      >
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </button>
      {showError && error && (
        <p className="absolute right-0 z-30 mt-2 w-64 rounded-xl bg-surface p-3 text-xs text-danger shadow-lg">
          {error}. Your data is safe on this phone and will retry automatically.
        </p>
      )}
    </div>
  )
}
