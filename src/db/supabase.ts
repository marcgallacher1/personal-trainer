import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

export const AUTH_STORAGE_KEY = 'trainer-auth'

/**
 * No cross-tab lock. supabase-js guards token refresh with the Web Locks API, but on iOS a lock
 * held when the home-screen app is suspended can never be released, so every later auth call
 * (and the app's startup) waits forever — a blank screen. The app runs in a single window, so a
 * plain pass-through is safe.
 */
const noLock = async <R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => fn()

// A placeholder client keeps imports safe when env is missing; the UI shows a config error instead.
export const supabase = createClient<Database>(
  url ?? 'http://localhost:54321',
  anonKey ?? 'missing-anon-key',
  {
    auth: {
      // localStorage persists inside the standalone iOS PWA (separate from Safari's storage).
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: AUTH_STORAGE_KEY,
      lock: noLock,
    },
  },
)
