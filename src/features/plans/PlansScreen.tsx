import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { Button } from '../../components/Button'
import { db } from '../../db/local'
import { weekSummary } from '../../lib/plans/draft'
import { usePlans } from './data'

export function PlansScreen() {
  const navigate = useNavigate()
  const plans = usePlans()
  // Per plan: its workouts with their days, for the one-line week summary
  const weeks = useLiveQuery(async () => {
    const [sessions, schedule] = await Promise.all([
      db.plan_sessions.toArray(),
      db.plan_schedule.toArray(),
    ])
    const out = new Map<string, { title: string; weekdays: number[] }[]>()
    for (const s of sessions) {
      if (s.deleted_at) continue
      const weekdays = schedule
        .filter((d) => !d.deleted_at && d.plan_session_id === s.id && d.weekday !== null)
        .map((d) => d.weekday!)
      out.set(s.plan_id, [...(out.get(s.plan_id) ?? []), { title: s.name, weekdays }])
    }
    return out
  }, [])

  const visible = (plans ?? [])
    .filter((p) => !p.archived)
    .toSorted((a, b) => Number(b.is_active) - Number(a.is_active))
  const archived = (plans ?? []).filter((p) => p.archived)

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Plans</PageTitle>

      <Button className="h-16 text-xl" onClick={() => void navigate('/plans/new')}>
        Start new plan
      </Button>
      <p className="-mt-2 text-center text-xs text-muted">
        Plans are optional — you can always just log workouts as you go.
      </p>

      {visible.map((p) => {
        const items = weeks?.get(p.id) ?? []
        const summary = weekSummary(items)
        return (
          <Link
            key={p.id}
            to={`/plans/${p.id}`}
            className={`block rounded-2xl p-4 active:opacity-80 ${
              p.is_active ? 'bg-accent/10 ring-2 ring-accent' : 'bg-surface'
            }`}
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
              {summary ||
                (items.length
                  ? `${items.length} workout${items.length === 1 ? '' : 's'}, no days set`
                  : 'No workouts yet')}
            </p>
          </Link>
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
    </div>
  )
}
