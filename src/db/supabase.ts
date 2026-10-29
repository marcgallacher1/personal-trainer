import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

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
      storageKey: 'trainer-auth',
    },
  },
)
