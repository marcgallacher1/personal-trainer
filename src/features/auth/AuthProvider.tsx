import type { Session } from '@supabase/supabase-js'
import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../db/supabase'

interface AuthState {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, loading: false })
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext value={state}>{children}</AuthContext>
}

export function useAuth(): AuthState {
  return use(AuthContext)
}
