import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { Button } from '../../components/Button'
import { Sheet } from '../../components/Sheet'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/local'
import { TEMPLATES, type PlanTemplate } from '../../lib/plans/templates'
import { createBlankPlan, createPlanFromTemplate, usePlans } from './data'

export function PlansScreen() {
  const navigate = useNavigate()
  const plans = usePlans()
  const [creating, setCreating] = useState(false)
  const sessionCounts = useLiveQuery(async () => {
    const counts = new Map<string, number>()
    for (const s of await db.plan_sessions.toArray()) {
      if (!s.deleted_at) counts.set(s.plan_id, (counts.get(s.plan_id) ?? 0) + 1)
    }
    return counts
  }, [])

  async function fromTemplate(t: PlanTemplate) {
    setCreating(false)
    const id = await createPlanFromTemplate(t)
    void navigate(`/plans/${id}`)
  }

  async function blank() {
    setCreating(false)
    const id = await createBlankPlan('My plan')
    void navigate(`/plans/${id}`)
  }

  const suggested = TEMPLATES.find((t) => t.suggested)
  const active = (plans ?? []).filter((p) => !p.archived)
  const archived = (plans ?? []).filter((p) => p.archived)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <PageTitle>Plans</PageTitle>
        {(plans?.length ?? 0) > 0 && (
          <button
            type="button"
            className="mb-4 text-sm font-semibold text-accent"
            onClick={() => setCreating(true)}
          >
            + New plan
          </button>
        )}
      </div>

      {plans && plans.length === 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-muted">
            A plan is your set of sessions (e.g. Push A, Pull A…). It drives the Today screen and
            loads exercises when you start a workout.
          </p>
          {suggested && (
            <button
              type="button"
              onClick={() => void fromTemplate(suggested)}
              className="rounded-3xl bg-accent p-5 text-left text-accent-fg"
            >
              <p className="text-sm font-semibold opacity-80">Suggested for you</p>
              <p className="text-xl font-bold">{suggested.name}</p>
              <p className="mt-1 text-sm opacity-90">{suggested.description}</p>
              <p className="mt-2 font-semibold">Use this plan ›</p>
            </button>
          )}
          <Button variant="secondary" onClick={() => setCreating(true)}>
            Other templates or a blank plan
          </Button>
        </div>
      )}

      {active.map((p) => (
        <Link
          key={p.id}
          to={`/plans/${p.id}`}
          className={`block rounded-2xl p-4 ${p.is_active ? 'bg-accent/15 ring-2 ring-accent' : 'bg-surface'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-lg font-bold">{p.name}</p>
            {p.is_active && (
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-fg">
                ACTIVE
              </span>
            )}
          </div>
          <p className="text-sm text-muted">
            {sessionCounts?.get(p.id) ?? 0} sessions ·{' '}
            {p.schedule_mode === 'rotation' ? 'Rotation, any days' : 'Fixed weekdays'}
          </p>
        </Link>
      ))}

      {archived.length > 0 && (
        <section>
          <h2 className="mt-2 mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Archived
          </h2>
          {archived.map((p) => (
            <Link
              key={p.id}
              to={`/plans/${p.id}`}
              className="block rounded-2xl bg-surface p-4 opacity-70"
            >
              <p className="truncate font-semibold">{p.name}</p>
            </Link>
          ))}
        </section>
      )}

      <Sheet
        open={creating}
        title="New plan"
        subtitle="Every template becomes a normal plan you can edit."
        closeLabel="Cancel"
        onClose={() => setCreating(false)}
      >
        <div className="flex flex-col gap-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void fromTemplate(t)}
              className={`rounded-2xl p-4 text-left ${t.suggested ? 'bg-accent/15 ring-2 ring-accent' : 'bg-surface'}`}
            >
              {t.suggested && (
                <p className="text-xs font-bold tracking-wide text-accent uppercase">
                  Suggested for you
                </p>
              )}
              <p className="text-lg font-bold">{t.name}</p>
              <p className="text-sm text-muted">{t.description}</p>
              <p className="mt-1 text-xs text-muted">{t.sessions.map((s) => s.name).join(' · ')}</p>
            </button>
          ))}
          <button
            type="button"
            onClick={() => void blank()}
            className="h-14 rounded-2xl border border-dashed border-border font-semibold text-muted"
          >
            Start from a blank plan
          </button>
        </div>
      </Sheet>
    </div>
  )
}
