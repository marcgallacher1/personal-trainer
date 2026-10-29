import { useState, type FormEvent } from 'react'
import { supabase } from '../../db/supabase'
import { Button } from '../../components/Button'

type Step = { kind: 'email' } | { kind: 'code'; email: string }

/**
 * Email one-time-code sign-in. We deliberately avoid magic *links*: on iOS they open in Safari,
 * whose storage is separate from the home-screen app, so the session would never reach the PWA.
 */
export function SignInScreen() {
  const [step, setStep] = useState<Step>({ kind: 'email' })
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const addr = email.trim().toLowerCase()
    const { error: err } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { shouldCreateUser: true },
    })
    setBusy(false)
    if (err) setError(err.message)
    else setStep({ kind: 'code', email: addr })
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    if (step.kind !== 'code') return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.verifyOtp({
      email: step.email,
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (err) setError(err.message)
    // On success AuthProvider receives the session and the router moves on.
  }

  return (
    <div className="flex min-h-full flex-col justify-center gap-8 px-safe pt-safe pb-safe">
      <div className="text-center">
        <img src="/logo.svg" alt="" className="mx-auto mb-4 h-20 w-20 rounded-2xl" />
        <h1 className="text-3xl font-bold">Trainer</h1>
        <p className="mt-1 text-muted">Sign in with a code sent to your email.</p>
      </div>

      {step.kind === 'email' ? (
        <form onSubmit={sendCode} className="flex flex-col gap-4">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-14 rounded-xl border border-border bg-surface px-4 text-lg outline-none focus:border-accent"
          />
          <Button type="submit" disabled={busy || !email}>
            {busy ? 'Sending…' : 'Send code'}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-4">
          <p className="text-center text-muted">
            Code sent to <span className="text-text">{step.email}</span>
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            required
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="h-16 rounded-xl border border-border bg-surface px-4 text-center text-3xl tracking-[0.4em] outline-none focus:border-accent"
          />
          <Button type="submit" disabled={busy || code.length < 6}>
            {busy ? 'Checking…' : 'Sign in'}
          </Button>
          <button
            type="button"
            className="h-12 text-muted"
            onClick={() => {
              setStep({ kind: 'email' })
              setCode('')
            }}
          >
            Use a different email
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-center text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
