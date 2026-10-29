import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { Confirm } from '../../components/Confirm'
import { showToast } from '../../components/Toast'
import { snapshotFromJson, summariseSnapshot } from '../../lib/plans/snapshot'
import { restoreVersion, usePlanRows, usePlanVersions, type PlanVersionRow } from './data'

export function PlanHistoryScreen() {
  const { planId } = useParams()
  const rows = usePlanRows(planId)
  const versions = usePlanVersions(planId)
  const [restoring, setRestoring] = useState<PlanVersionRow | null>(null)

  if (!rows) return null
  const current = rows.plan.current_version

  return (
    <div className="flex flex-col gap-4">
      <Link to={`/plans/${rows.plan.id}`} className="text-sm text-accent">
        ‹ {rows.plan.name}
      </Link>
      <PageTitle>Version history</PageTitle>
      <p className="-mt-2 text-sm text-muted">
        A version is saved whenever you leave the plan editor after changing something. Restoring
        saves your current plan first, so you can always go back.
      </p>

      <ul className="flex flex-col gap-2">
        {(versions ?? []).map((v) => {
          const snap = snapshotFromJson(v.snapshot_json)
          return (
            <li key={v.id} className="rounded-2xl bg-surface p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-bold">
                  Version {v.version}
                  {v.version === current && (
                    <span className="ml-2 text-xs font-semibold text-accent">current</span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {new Date(v.created_at).toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
              <p className="text-sm text-muted">
                {v.note ? `${v.note} · ` : ''}
                {summariseSnapshot(snap)}
              </p>
              <p className="text-xs text-muted">
                {snap.sessions
                  .toSorted((a, b) => a.order - b.order)
                  .map((s) => s.name)
                  .join(' · ')}
              </p>
              {v.version !== current && (
                <button
                  type="button"
                  className="mt-2 h-10 rounded-full bg-surface-2 px-4 text-sm font-semibold"
                  onClick={() => setRestoring(v)}
                >
                  Restore this version
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <Confirm
        open={restoring !== null}
        title={`Restore version ${restoring?.version}?`}
        body="Your current plan is saved as a new version first."
        confirmLabel="Restore"
        onCancel={() => setRestoring(null)}
        onConfirm={async () => {
          const v = restoring
          setRestoring(null)
          if (!v) return
          await restoreVersion(v)
          showToast({ message: `Restored version ${v.version}` })
        }}
      />
    </div>
  )
}
