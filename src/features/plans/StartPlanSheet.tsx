import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Sheet } from '../../components/Sheet'
import { useExercises } from '../../db/queries'
import { asLogType } from '../../lib/logging/logTypes'
import type { PlanSessionRow } from '../../lib/plans/instantiate'
import { isoWeekday } from '../../lib/plans/schedule'
import { describeTargets } from '../../lib/plans/targets'
import { versionTitle } from '../../lib/plans/templates'
import { startSession } from '../log/actions'
import { londonDate } from '../log/format'
import { startFromPlan, usePlanLibrary, type PlanWithVersions } from './data'
import { WEEKDAYS, WeekdayPicker } from './WeekdayPicker'

interface Props {
  open: boolean
  onClose: () => void
}

/** Start plan → pick a plan (Push, Pull…) → pick a version (A, B…) → Start. */
export function StartPlanSheet({ open, onClose }: Props) {
  const navigate = useNavigate()
  const library = usePlanLibrary()
  const exercises = useExercises()
  const [planId, setPlanId] = useState<string | null>(null)
  const [today] = useState(() => londonDate(new Date().toISOString()))
  const weekday = isoWeekday(today)

  const close = () => {
    setPlanId(null)
    onClose()
  }

  async function start(version: PlanSessionRow) {
    const id = await startFromPlan(version)
    close()
    void navigate(`/log/session/${id}`)
  }

  async function startEmpty() {
    const id = await startSession()
    close()
    void navigate(`/log/session/${id}`)
  }

  const plans = library ?? []
  const chosen = plans.find((p) => p.plan.id === planId)
  const scheduledToday = plans.flatMap((p) =>
    p.versions
      .filter((v) => p.schedule.some((s) => s.plan_session_id === v.id && s.weekday === weekday))
      .map((v) => ({ plan: p.plan, version: v })),
  )
  const names = new Map((exercises ?? []).map((e) => [e.id, e]))

  return (
    <Sheet
      open={open}
      title={chosen ? chosen.plan.name : 'Start a plan'}
      subtitle={chosen ? 'Pick a version' : 'Choose what you’re training today'}
      closeLabel="Cancel"
      onClose={close}
    >
      {!chosen ? (
        <div className="flex flex-col gap-4">
          {scheduledToday.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
                Scheduled for {WEEKDAYS[weekday - 1]}
              </h3>
              <div className="flex flex-col gap-2">
                {scheduledToday.map(({ plan, version }) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => void start(version)}
                    className="flex items-center gap-3 rounded-2xl bg-accent p-4 text-left text-accent-fg"
                  >
                    <span className="text-2xl">{version.emoji ?? '🏋️'}</span>
                    <span className="min-w-0 flex-1 text-lg font-bold">
                      Start {versionTitle(plan.name, version.name)}
                    </span>
                    <span className="text-2xl">›</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            {scheduledToday.length > 0 && (
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
                All plans
              </h3>
            )}
            {plans.length === 0 && (
              <p className="rounded-2xl bg-surface p-4 text-center text-muted">
                No plans yet.{' '}
                <Link to="/plans" className="font-semibold text-accent" onClick={close}>
                  Create one
                </Link>
              </p>
            )}
            <div className="flex flex-col gap-2">
              {plans.map((p) => (
                <button
                  key={p.plan.id}
                  type="button"
                  onClick={() => setPlanId(p.plan.id)}
                  className="flex items-center gap-3 rounded-2xl bg-surface p-4 text-left active:opacity-80"
                >
                  <span className="text-2xl">{p.versions[0]?.emoji ?? '🏋️'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold">{p.plan.name}</span>
                    <span className="block truncate text-sm text-muted">
                      {p.versions.length === 1
                        ? '1 version'
                        : `${p.versions.length} versions: ${p.versions.map((v) => v.name).join(', ')}`}
                    </span>
                  </span>
                  <span className="text-2xl text-muted">›</span>
                </button>
              ))}
            </div>
          </section>

          <button
            type="button"
            onClick={() => void startEmpty()}
            className="h-14 rounded-2xl border border-dashed border-border font-semibold text-muted"
          >
            Empty workout (no plan)
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setPlanId(null)}
            className="-ml-2 flex h-10 items-center gap-1 self-start px-2 font-semibold text-accent"
          >
            <span className="text-2xl leading-none">‹</span> All plans
          </button>
          {chosen.versions.length === 0 && (
            <p className="rounded-2xl bg-surface p-4 text-center text-muted">
              This plan has no versions yet.
            </p>
          )}
          {chosen.versions.map((v) => (
            <VersionCard
              key={v.id}
              entry={chosen}
              version={v}
              exerciseName={(id) => names.get(id)?.name ?? 'Unknown'}
              exerciseLogType={(id) => asLogType(names.get(id)?.log_type)}
              onStart={() => void start(v)}
              onClose={close}
            />
          ))}
        </div>
      )}
    </Sheet>
  )
}

function VersionCard({
  entry,
  version,
  exerciseName,
  exerciseLogType,
  onStart,
  onClose,
}: {
  entry: PlanWithVersions
  version: PlanSessionRow
  exerciseName: (id: string) => string
  exerciseLogType: (id: string) => ReturnType<typeof asLogType>
  onStart: () => void
  onClose: () => void
}) {
  const items = entry.exercises.filter((e) => e.plan_session_id === version.id)
  const title = versionTitle(entry.plan.name, version.name)
  return (
    <section className="rounded-3xl bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="text-3xl">{version.emoji ?? '🏋️'}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold">{title}</h3>
          {version.notes && <p className="text-sm text-muted">{version.notes}</p>}
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {items.map((pe) => (
          <li key={pe.id} className="flex justify-between gap-3">
            <span className="truncate">{exerciseName(pe.exercise_id)}</span>
            <span className="shrink-0 text-muted">
              {describeTargets(
                entry.targets.filter((t) => t.plan_exercise_id === pe.id),
                exerciseLogType(pe.exercise_id),
              )
                .replace(/ reps/g, '')
                .replace(' · to failure', '')}
            </span>
          </li>
        ))}
        {items.length === 0 && <li className="text-muted">No exercises yet.</li>}
      </ul>

      <p className="mt-4 mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Days</p>
      <WeekdayPicker planId={entry.plan.id} sessionId={version.id} schedule={entry.schedule} />

      <div className="mt-4 flex gap-2">
        <Link
          to={`/plans/${entry.plan.id}/sessions/${version.id}`}
          onClick={onClose}
          className="flex h-14 items-center justify-center rounded-2xl bg-surface-2 px-5 font-semibold"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={onStart}
          className="h-14 flex-1 rounded-2xl bg-accent text-lg font-bold text-accent-fg"
        >
          Start {title}
        </button>
      </div>
    </section>
  )
}
