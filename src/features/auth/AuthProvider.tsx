import type { Session } from '@supabase/supabase-js'
import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { AUTH_STORAGE_KEY, supabase } from '../../db/supabase'

interface AuthState {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, loading: true })

/** If the auth check stalls (e.g. offline), use the saved session. */
const GET_SESSION_TIMEOUT_MS = 5000

function storedSession(): Session | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    let settled = false
    const settle = (session: Session | null) => {
      settled = true
      setState({ session, loading: false })
    }
    const timer = setTimeout(() => {
      if (!settled) settle(storedSession())
    }, GET_SESSION_TIMEOUT_MS)

    supabase.auth
      .getSession()
      .then(({ data }) => settle(data.session))
      .catch(() => settle(storedSession()))

    const { data } = supabase.auth.onAuthStateChange((_event, session) => settle(session))
    return () => {
      clearTimeout(timer)
      data.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext value={state}>{children}</AuthContext>
}

export function useAuth(): AuthState {
  return use(AuthContext)
}
