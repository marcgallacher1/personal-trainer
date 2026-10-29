import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/Toast'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/local'
import type { PlanSessionRow } from '../../lib/plans/instantiate'
import { splitByCategory, TEMPLATES, type PlanTemplate } from '../../lib/plans/templates'
import { canSplit, createBlankPlan, createPlanFromTemplate, splitPlan, usePlans } from './data'

export function PlansScreen() {
  const navigate = useNavigate()
  const plans = usePlans()
  const [creating, setCreating] = useState(false)
  const [customName, setCustomName] = useState('')
  const versionsByPlan = useLiveQuery(async () => {
    const map = new Map<string, PlanSessionRow[]>()
    for (const s of await db.plan_sessions.toArray()) {
      if (s.deleted_at) continue
      map.set(
        s.plan_id,
        [...(map.get(s.plan_id) ?? []), s].toSorted((a, b) => a.order - b.order),
      )
    }
    return map
  }, [])

  async function fromTemplate(t: PlanTemplate) {
    setCreating(false)
    const id = await createPlanFromTemplate(t)
    void navigate(`/plans/${id}`)
  }

  async function custom() {
    const name = customName.trim()
    if (!name) return
    setCreating(false)
    setCustomName('')
    const id = await createBlankPlan(name)
    void navigate(`/plans/${id}`)
  }

  const visible = (plans ?? []).filter((p) => !p.archived)
  const archived = (plans ?? []).filter((p) => p.archived)
  const existingNames = new Set(visible.map((p) => p.name.toLowerCase()))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <PageTitle>Plans</PageTitle>
        <button
          type="button"
          className="mb-4 text-sm font-semibold text-accent"
          onClick={() => setCreating(true)}
        >
          + New plan
        </button>
      </div>
      <p className="-mt-3 text-sm text-muted">
        Each plan is a type of workout (Push, Pull, Legs…) with versions A, B… Start one from the
        Today screen.
      </p>

      {plans && visible.length === 0 && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-3xl bg-accent p-5 text-left text-accent-fg"
        >
          <p className="text-xl font-bold">Create your first plan</p>
          <p className="mt-1 text-sm opacity-90">
            Start from Push, Pull, Shoulders & arms, Back & arms… or make your own.
          </p>
        </button>
      )}

      {visible.map((p) => {
        const versions = versionsByPlan?.get(p.id) ?? []
        const mixed = canSplit(versions)
        return (
          <div key={p.id} className="rounded-2xl bg-surface">
            <Link to={`/plans/${p.id}`} className="flex items-center gap-3 p-4">
              <span className="text-2xl">{versions[0]?.emoji ?? '🏋️'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-bold">{p.name}</span>
                <span className="block truncate text-sm text-muted">
                  {mixed
                    ? versions.map((v) => v.name).join(' · ')
                    : `${versions.length} version${versions.length === 1 ? '' : 's'}${
                        versions.length ? `: ${versions.map((v) => v.name).join(', ')}` : ''
                      }`}
                </span>
              </span>
              <span className="text-2xl text-muted">›</span>
            </Link>
            {mixed && (
              <div className="border-t border-border p-4">
                <p className="text-sm">
                  This plan mixes workout types. Split it into{' '}
                  <b>
                    {splitByCategory(versions)
                      .map((g) => g.category)
                      .join(', ')}
                  </b>
                  ? Your logged workouts stay linked.
                </p>
                <button
                  type="button"
                  className="mt-2 h-11 w-full rounded-xl bg-accent font-bold text-accent-fg"
                  onClick={async () => {
                    const ids = await splitPlan(p)
                    showToast({ message: `Split into ${ids.length} plans` })
                  }}
                >
                  Split it up
                </button>
              </div>
            )}
          </div>
        )
      })}

      {archived.length > 0 && (
        <section>
          <h2 className="mt-2 mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Archived
          </h2>
          {archived.map((p) => (
            <Link
              key={p.id}
              to={`/plans/${p.id}`}
              className="mb-2 block rounded-2xl bg-surface p-4 opacity-70"
            >
              <p className="truncate font-semibold">{p.name}</p>
            </Link>
          ))}
        </section>
      )}

      <Sheet
        open={creating}
        title="New plan"
        subtitle="Starts with exercises you can change, or make your own."
        closeLabel="Cancel"
        onClose={() => setCreating(false)}
      >
        <div className="flex flex-col gap-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void custom()
            }}
          >
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Your own, e.g. Arms"
              className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!customName.trim()}
              className="h-12 rounded-xl bg-accent px-4 font-bold text-accent-fg disabled:opacity-40"
            >
              Create
            </button>
          </form>

          <h3 className="mt-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Or start from
          </h3>
          {[...TEMPLATES]
            .toSorted((a, b) => Number(Boolean(b.suggested)) - Number(Boolean(a.suggested)))
            .map((t) => {
              const exists = existingNames.has(t.name.toLowerCase())
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => void fromTemplate(t)}
                  className={`rounded-2xl p-4 text-left ${t.suggested ? 'bg-accent/10' : 'bg-surface'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-bold">
                      {t.sessions[0]?.emoji} {t.name}
                    </p>
                    {exists && <span className="text-xs text-muted">you have this</span>}
                  </div>
                  <p className="text-sm text-muted">{t.description}</p>
                  <p className="mt-1 text-xs text-muted">
                    Versions: {t.sessions.map((s) => s.name).join(', ')}
                    {t.suggested ? ' · suits your upper-body focus' : ''}
                  </p>
                </button>
              )
            })}
        </div>
      </Sheet>
    </div>
  )
}
