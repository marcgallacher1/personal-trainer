import { useEffect, useState } from 'react'

/** Clears cached app files and reloads. Workouts and sign-in are kept. */
export async function resetAppCache(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
    const keys = (await caches?.keys()) ?? []
    await Promise.all(keys.map((k) => caches.delete(k)))
  } finally {
    window.location.reload()
  }
}

/** Shown instead of a blank screen while the app starts. Explains itself if startup stalls. */
export function BootScreen({ waitingFor, error }: { waitingFor: string; error?: string }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-safe pt-safe pb-safe text-center">
      <img src="/logo.svg" alt="" className="h-16 w-16 rounded-2xl" />
      {error ? (
        <>
          <p className="text-lg font-bold">Trainer couldn’t start</p>
          <p className="max-w-xs text-sm text-muted">{error}</p>
        </>
      ) : (
        <p className="text-muted">Loading…</p>
      )}
      {(slow || error) && (
        <div className="flex max-w-xs flex-col gap-2">
          {!error && (
            <p className="text-sm text-muted">
              This is taking longer than usual (waiting for {waitingFor}).
            </p>
          )}
          <button
            type="button"
            className="h-12 rounded-xl bg-accent font-bold text-accent-fg"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <button
            type="button"
            className="h-12 rounded-xl bg-surface font-semibold"
            onClick={() => void resetAppCache()}
          >
            Reset app (keeps your workouts)
          </button>
        </div>
      )}
    </div>
  )
}
