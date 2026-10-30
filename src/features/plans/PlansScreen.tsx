import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { Button } from '../../components/Button'
import { showToast } from '../../components/Toast'
import { db } from '../../db/local'
import { weekSummary } from '../../lib/plans/draft'
import type { PlanRow } from '../../lib/plans/instantiate'
import { setPlanActive, usePlans } from './data'

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

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Plans</PageTitle>

      <Button className="h-16 text-xl" onClick={() => void navigate('/plans/new')}>
        Start new plan
      </Button>

      {(plans ?? []).map((p) => (
        <PlanCard key={p.id} plan={p} summary={weekSummary(weeks?.get(p.id) ?? [])} />
      ))}
    </div>
  )
}

function PlanCard({ plan, summary }: { plan: PlanRow; summary: string }) {
  const on = plan.is_active
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl p-4 ${
        on ? 'bg-accent/10 ring-2 ring-accent' : 'bg-surface'
      }`}
    >
      <Link to={`/plans/${plan.id}`} className="min-w-0 flex-1 active:opacity-70">
        <p className="truncate text-lg font-bold">{plan.name}</p>
        <p className={`truncate text-sm ${on ? 'text-text' : 'text-muted'}`}>
          {summary || 'No days set yet'}
        </p>
      </Link>
      <Slider
        on={on}
        label={`${plan.name} active`}
        onChange={(v) =>
          void setPlanActive(plan, v).then(() =>
            showToast({ message: v ? `${plan.name} is now active` : `${plan.name} switched off` }),
          )
        }
      />
    </div>
  )
}

/** Small on/off slider. */
export function Slider({
  on,
  label,
  onChange,
}: {
  on: boolean
  label: string
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
        on ? 'bg-accent' : 'bg-surface-2 ring-1 ring-border'
      }`}
    >
      <span
        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
          on ? 'left-7' : 'left-1'
        }`}
      />
    </button>
  )
}
