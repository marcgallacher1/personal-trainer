import { useSyncExternalStore } from 'react'

export interface SyncState {
  status: 'idle' | 'syncing' | 'offline' | 'error'
  lastSyncedAt: number | null
  error: string | null
}

let state: SyncState = { status: 'idle', lastSyncedAt: null, error: null }
const listeners = new Set<() => void>()

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

let running: Promise<void> | null = null
let rerun = false

/** Push then pull. Concurrent calls coalesce into one extra run. */
export function syncNow(): Promise<void> {
  if (!navigator.onLine) {
    set({ status: 'offline' })
    return Promise.resolve()
  }
  if (running) {
    rerun = true
    return running
  }
  running = (async () => {
    // Lazy import: sync.ts imports write.ts, which imports this module.
    const { push, pull } = await import('./sync')
    do {
      rerun = false
      set({ status: 'syncing' })
      await push()
      await pull()
    } while (rerun)
    set({ status: 'idle', lastSyncedAt: Date.now(), error: null })
  })()
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e)
      set({ status: navigator.onLine ? 'error' : 'offline', error: message })
    })
    .finally(() => {
      running = null
    })
  return running
}

let debounce: ReturnType<typeof setTimeout> | undefined

/** Called after every local write. */
export function requestSync(): void {
  clearTimeout(debounce)
  debounce = setTimeout(() => void syncNow(), 800)
}

const onOffline = () => set({ status: 'offline' })

/** Sync on start, when back online, when the app returns to the foreground, and every 30s. */
export function startSyncLoop(): () => void {
  const onOnline = () => void syncNow()
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncNow()
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)
  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, 30_000)
  void syncNow()
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(timer)
  }
}
