import { useState } from 'react'
import { PageTitle } from '../../app/Layout'
import { Button } from '../../components/Button'
import { ComingSoon } from '../../components/ComingSoon'
import { supabase } from '../../db/supabase'
import { useAuth } from '../auth/AuthProvider'

export function MoreScreen() {
  const { session } = useAuth()
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <PageTitle>More</PageTitle>
      <div className="flex flex-col gap-4">
        <ComingSoon phase="Phases 4–8">Reports, Data and Settings live here.</ComingSoon>

        <section className="rounded-2xl bg-surface p-4">
          <p className="text-sm text-muted">Signed in as</p>
          <p className="truncate text-lg">{session?.user.email}</p>
        </section>

        {confirming ? (
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => void supabase.auth.signOut()}
            >
              Sign out
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirming(true)}>
            Sign out
          </Button>
        )}
        <p className="text-center text-xs text-muted">Trainer v{__APP_VERSION__}</p>
      </div>
    </>
  )
}
