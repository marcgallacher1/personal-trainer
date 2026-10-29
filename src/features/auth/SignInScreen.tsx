import { useState, type FormEvent } from 'react'
import { supabase } from '../../db/supabase'
import { Button } from '../../components/Button'

type Mode = 'sign-in' | 'create'

/**
 * Email + password sign-in. Email links/codes aren't usable: on iOS a link opens in Safari (separate
 * storage from the home-screen app), and Supabase's free tier can't customise emails to send codes.
 * Sessions persist, so this is a one-off per device.
 */
export function SignInScreen() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const credentials = { email: email.trim().toLowerCase(), password }
    const { data, error: err } =
      mode === 'create'
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials)
    setBusy(false)
    if (err) setError(err.message)
    else if (!data.session) setError('Account created but not signed in. Try signing in.')
    // On success AuthProvider receives the session and the app opens.
  }

  const creating = mode === 'create'

  return (
    <div className="flex min-h-full flex-col justify-center gap-8 px-safe pt-safe pb-safe">
      <div className="text-center">
        <img src="/logo.svg" alt="" className="mx-auto mb-4 h-20 w-20 rounded-2xl" />
        <h1 className="text-3xl font-bold">Trainer</h1>
        <p className="mt-1 text-muted">
          {creating ? 'Create your account.' : 'Sign in to continue.'}
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <input
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-14 rounded-xl border border-border bg-surface px-4 text-lg outline-none focus:border-accent"
        />
        <input
          type="password"
          autoComplete={creating ? 'new-password' : 'current-password'}
          required
          minLength={creating ? 8 : undefined}
          placeholder={creating ? 'Password (8+ characters)' : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-14 rounded-xl border border-border bg-surface px-4 text-lg outline-none focus:border-accent"
        />
        <Button type="submit" disabled={busy || !email || !password}>
          {busy ? 'Please wait…' : creating ? 'Create account' : 'Sign in'}
        </Button>
        <button
          type="button"
          className="h-12 text-muted"
          onClick={() => {
            setMode(creating ? 'sign-in' : 'create')
            setError(null)
          }}
        >
          {creating ? 'I already have an account' : 'First time? Create an account'}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-center text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
