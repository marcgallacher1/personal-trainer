import { useState } from 'react'
import { BackButton } from '../../components/BackButton'
import { Link, useNavigate, useParams } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { Confirm } from '../../components/Confirm'
import { showToast } from '../../components/Toast'
import { useExercise, useExerciseHistory, useExerciseMuscleMap, useMuscles } from '../../db/queries'
import { asLogType, formatSet, headlineStats, LOG_TYPE_INFO } from '../../lib/logging/logTypes'
import { asLoadMode } from '../../lib/logging/types'
import { EQUIPMENT_LABELS, label, PATTERN_LABELS } from '../../lib/seed/labels'
import { deleteCustomExercise } from './actions'

export function ExerciseDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const exercise = useExercise(id)
  const history = useExerciseHistory(id ?? '')
  const muscleMap = useExerciseMuscleMap()
  const muscles = useMuscles()
  const [confirm, setConfirm] = useState(false)

  if (exercise === undefined) return null
  if (exercise === null || exercise.deleted_at) {
    return (
      <p className="py-12 text-center text-muted">
        Exercise not found.{' '}
        <Link to="/exercises" className="text-accent">
          Back
        </Link>
      </p>
    )
  }

  const mapping = (muscleMap?.get(exercise.id) ?? []).toSorted((a, b) => b.weight - a.weight)
  const name = (m: string) => muscles?.find((x) => x.id === m)?.name ?? m
  const logType = asLogType(exercise.log_type)
  const sets = (history ?? []).filter((s) => !s.deleted_at && s.set_type !== 'warmup')
  const stats = headlineStats(sets, logType)

  // Recent sessions, newest first
  const bySession = new Map<string, typeof sets>()
  for (const s of [...sets].toSorted((a, b) => b.completed_at.localeCompare(a.completed_at))) {
    bySession.set(s.session_id, [...(bySession.get(s.session_id) ?? []), s])
  }
  const recent = [...bySession.values()].slice(0, 6)

  return (
    <div className="flex flex-col gap-4">
      <BackButton fallback="/exercises" />
      <div>
        <PageTitle>{exercise.name}</PageTitle>
        <p className="-mt-3 text-sm text-muted">
          {label(EQUIPMENT_LABELS, exercise.equipment)} · {label(PATTERN_LABELS, exercise.pattern)}
          {exercise.is_custom && ' · custom'}
        </p>
        <p className="text-sm text-muted">Logged as: {LOG_TYPE_INFO[logType].name}</p>
      </div>

      <section className="rounded-2xl bg-surface p-4">
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
          Muscles worked
        </h2>
        <ul className="flex flex-wrap gap-2">
          {mapping.map((m) => (
            <li
              key={m.muscle_id}
              className={`rounded-full px-3 py-1 text-sm ${m.weight >= 1 ? 'bg-accent text-accent-fg' : 'bg-surface-2'}`}
            >
              {name(m.muscle_id)} {m.weight >= 1 ? '' : '(½)'}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Primary muscles count as a full set, secondary as half.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-surface p-4">
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-sm text-muted">
              {s.label}
              {s.detail ? ` · ${s.detail}` : ''}
            </p>
          </div>
        ))}
      </section>

      {recent.length > 0 && (
        <section className="rounded-2xl bg-surface p-4">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Recent</h2>
          <ul className="flex flex-col gap-2">
            {recent.map((ss) => (
              <li key={ss[0]!.session_id}>
                <Link
                  to={`/log/session/${ss[0]!.session_id}`}
                  className="flex justify-between gap-3"
                >
                  <span className="text-sm text-muted">
                    {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
                      new Date(ss[0]!.completed_at),
                    )}
                  </span>
                  <span className="truncate text-sm tabular-nums">
                    {[...ss]
                      .toSorted((a, b) => a.order - b.order)
                      .map((s) => formatSet(s, logType, asLoadMode(exercise.load_mode)))
                      .join(' · ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {exercise.is_custom && (
        <div className="flex gap-3">
          <Link
            to={`/exercises/${exercise.id}/edit`}
            className="flex h-12 flex-1 items-center justify-center rounded-xl bg-surface font-semibold"
          >
            Edit
          </Link>
          <button
            type="button"
            className="h-12 flex-1 rounded-xl bg-surface font-semibold text-danger"
            onClick={() => setConfirm(true)}
          >
            Delete
          </button>
        </div>
      )}

      <Confirm
        open={confirm}
        title={`Delete ${exercise.name}?`}
        body="Logged sets stay in your history."
        confirmLabel="Delete"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          await deleteCustomExercise(exercise)
          showToast({ message: 'Exercise deleted' })
          void navigate('/exercises')
        }}
      />
    </div>
  )
}
