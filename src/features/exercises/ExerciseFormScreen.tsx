import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { Button } from '../../components/Button'
import { useExercise, useExerciseMuscleMap, useMuscles, type Exercise } from '../../db/queries'
import { asLogType, LOG_TYPE_INFO } from '../../lib/logging/logTypes'
import { LOG_TYPES } from '../../lib/logging/types'
import type { Equipment, MovementPattern } from '../../lib/seed/exercises'
import { EQUIPMENT_LABELS, PATTERN_LABELS } from '../../lib/seed/labels'
import { addExercise } from '../log/actions'
import { saveCustomExercise, type ExerciseInput, type MuscleRole } from './actions'
import { Chip } from './ExerciseList'

/** /exercises/new (optionally ?addTo=<sessionId>) and /exercises/:id/edit */
export function ExerciseFormScreen() {
  const { id } = useParams()
  const existing = useExercise(id)
  const muscleMap = useExerciseMuscleMap()

  if (id && (existing === undefined || muscleMap === undefined)) return null
  if (id && (!existing || !existing.is_custom)) {
    return <p className="py-12 text-center text-muted">Only custom exercises can be edited.</p>
  }

  const initial: ExerciseInput = existing
    ? {
        name: existing.name,
        equipment: existing.equipment as Equipment,
        pattern: existing.pattern as MovementPattern,
        logType: asLogType(existing.log_type),
        muscles: Object.fromEntries(
          (muscleMap?.get(existing.id) ?? []).map((m) => [
            m.muscle_id,
            m.weight >= 1 ? 'primary' : 'secondary',
          ]),
        ),
      }
    : { name: '', equipment: 'machine', pattern: 'isolation', logType: 'weight_reps', muscles: {} }

  return <Form key={existing?.id ?? 'new'} initial={initial} existing={existing ?? undefined} />
}

function Form({ initial, existing }: { initial: ExerciseInput; existing?: Exercise }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const addTo = params.get('addTo')
  const muscles = useMuscles()
  const [v, setV] = useState<ExerciseInput>(initial)
  const [busy, setBusy] = useState(false)

  const hasPrimary = Object.values(v.muscles).includes('primary')
  const cycle = (id: string) => {
    const next: Record<string, MuscleRole> = { ...v.muscles }
    const cur = next[id]
    if (!cur) next[id] = 'primary'
    else if (cur === 'primary') next[id] = 'secondary'
    else delete next[id]
    setV({ ...v, muscles: next })
  }

  async function submit() {
    setBusy(true)
    const exercise = await saveCustomExercise(v, existing)
    if (addTo) {
      const seId = await addExercise(addTo, exercise)
      void navigate(`/log/session/${addTo}?open=${seId}`, { replace: true })
    } else {
      void navigate(`/exercises/${exercise.id}`, { replace: true })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link to={addTo ? `/log/session/${addTo}` : '/exercises'} className="text-sm text-accent">
        ‹ Back
      </Link>
      <PageTitle>{existing ? 'Edit exercise' : 'New exercise'}</PageTitle>

      <input
        value={v.name}
        onChange={(e) => setV({ ...v, name: e.target.value })}
        placeholder="Exercise name"
        className="h-14 rounded-xl border border-border bg-surface px-4 text-lg outline-none focus:border-accent"
      />

      <Field title="Equipment">
        {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((k) => (
          <Chip
            key={k}
            active={v.equipment === k}
            onClick={() =>
              setV({
                ...v,
                equipment: k,
                // Sensible default when switching to/from bodyweight; still changeable below
                logType:
                  k === 'bodyweight'
                    ? 'bodyweight_reps'
                    : v.logType === 'bodyweight_reps'
                      ? 'weight_reps'
                      : v.logType,
              })
            }
          >
            {EQUIPMENT_LABELS[k]}
          </Chip>
        ))}
      </Field>

      <Field title="Movement pattern">
        {(Object.keys(PATTERN_LABELS) as MovementPattern[]).map((k) => (
          <Chip key={k} active={v.pattern === k} onClick={() => setV({ ...v, pattern: k })}>
            {PATTERN_LABELS[k]}
          </Chip>
        ))}
      </Field>

      <Field title="How you log it">
        <div className="flex w-full flex-col gap-2">
          {LOG_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={v.logType === t}
              onClick={() => setV({ ...v, logType: t })}
              className={`flex min-h-12 flex-col justify-center rounded-xl px-4 py-2 text-left ${
                v.logType === t ? 'bg-accent text-accent-fg' : 'bg-surface'
              }`}
            >
              <span className="font-semibold">{LOG_TYPE_INFO[t].name}</span>
              <span className={`text-xs ${v.logType === t ? 'opacity-80' : 'text-muted'}`}>
                {LOG_TYPE_INFO[t].description}
              </span>
            </button>
          ))}
        </div>
      </Field>

      <Field
        title="Muscles"
        hint="Tap once for primary (counts as 1 set), twice for secondary (½), three times to clear."
      >
        {(muscles ?? []).map((m) => {
          const role = v.muscles[m.id]
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => cycle(m.id)}
              className={`h-9 rounded-full px-4 text-sm font-medium ${
                role === 'primary'
                  ? 'bg-accent text-accent-fg'
                  : role === 'secondary'
                    ? 'bg-accent/25 text-text'
                    : 'bg-surface text-muted'
              }`}
            >
              {m.name}
              {role === 'secondary' && ' ½'}
            </button>
          )
        })}
      </Field>

      <Button disabled={busy || !v.name.trim() || !hasPrimary} onClick={() => void submit()}>
        {existing ? 'Save changes' : addTo ? 'Create and add to workout' : 'Create exercise'}
      </Button>
      {!hasPrimary && (
        <p className="-mt-3 text-center text-sm text-muted">Pick at least one primary muscle.</p>
      )}
    </div>
  )
}

function Field({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  )
}
