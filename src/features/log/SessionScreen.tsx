import { useEffect, useState } from 'react'
import { BackButton } from '../../components/BackButton'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { Confirm } from '../../components/Confirm'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/Toast'
import {
  useExercises,
  useSession,
  useSessionCardio,
  useSessionExercises,
  useSessionSets,
  type CardioEntry,
  type Exercise,
  type Session,
  type SetRow,
} from '../../db/queries'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/local'
import { describeTargets } from '../../lib/plans/targets'
import { ExerciseList } from '../exercises/ExerciseList'
import { addWorkoutExerciseToPlan, discardIfEmpty } from '../plans/data'
import {
  addExercise,
  deleteSession,
  finishSession,
  moveSessionExercise,
  undoDeletion,
  updateSession,
} from './actions'
import { cardioEmoji, cardioName, cardioSummary } from '../../lib/cardio'
import { CardioLogger } from './CardioLogger'
import { asLogType, formatSet } from '../../lib/logging/logTypes'
import type { LogType } from '../../lib/logging/types'
import { ExerciseLogger } from './ExerciseLogger'
import { formatDuration, sessionTitle } from './format'

/** Workout overview: one summary card per exercise; tap a card to log it in a full-screen modal. */
export function SessionScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const session = useSession(id)
  const exercises = useSessionExercises(id)
  const sets = useSessionSets(id)
  const cardio = useSessionCardio(id)
  const library = useExercises()
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reordering, setReordering] = useState(false)
  /** 'new' = adding cardio; an entry = editing it */
  const [cardioOpen, setCardioOpen] = useState<CardioEntry | 'new' | null>(null)
  const plannedTargets = useLiveQuery(async () => {
    const ids = (exercises ?? []).map((e) => e.plan_exercise_id).filter((x): x is string => !!x)
    return ids.length
      ? (await db.plan_set_targets.where('plan_exercise_id').anyOf(ids).toArray()).filter(
          (t) => !t.deleted_at,
        )
      : []
  }, [exercises])
  const plannedFor = (peId: string | null, lt: LogType) => {
    if (!peId || !plannedTargets) return null
    const ts = plannedTargets
      .filter((t) => t.plan_exercise_id === peId)
      .toSorted((a, b) => a.order - b.order)
    return ts.length ? describeTargets(ts, lt) : null
  }

  // ?open=<session_exercise_id> opens that exercise's logger (used after creating a custom exercise)
  const openId = params.get('open')
  const setOpenId = (seId: string | null) =>
    setParams(seId ? { open: seId } : {}, { replace: true })

  if (session === undefined) return null
  if (session === null || session.deleted_at) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted">This workout doesn't exist any more.</p>
        <Link to="/log" className="mt-4 inline-block text-accent">
          Back to Log
        </Link>
      </div>
    )
  }

  const byId = new Map((library ?? []).map((e) => [e.id, e]))
  const list = exercises ?? []
  const allSets = sets ?? []
  const cardioList = cardio ?? []
  const active = session.ended_at === null
  const workingSets = allSets.filter((s) => s.set_type !== 'warmup')
  const openIndex = list.findIndex((se) => se.id === openId)
  const open = openIndex >= 0 ? list[openIndex] : undefined

  async function pick(e: Exercise) {
    setPicking(false)
    const s = session!
    const seId = await addExercise(s.id, e)
    setOpenId(seId)
    // Workout from a plan: offer to keep this exercise in the plan for next time
    if (s.plan_session_id) {
      const planSessionId = s.plan_session_id
      showToast({
        message: `Added ${e.name} for today`,
        action: {
          label: 'Add to plan',
          onClick: () =>
            void db.session_exercises.get(seId).then((se) => {
              if (!se) return
              void addWorkoutExerciseToPlan(se, planSessionId, e, asLogType(e.log_type)).then(() =>
                showToast({ message: `${e.name} added to the plan` }),
              )
            }),
        },
      })
    }
  }

  async function remove(s: Session) {
    setConfirmDelete(false)
    const changes = await deleteSession(s)
    void navigate('/', { replace: true })
    showToast({
      message: 'Workout deleted',
      action: { label: 'Undo', onClick: () => void undoDeletion(changes) },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <BackButton
          fallback="/"
          onBack={async () => {
            // Nothing logged? Don't leave an empty workout behind.
            if (await discardIfEmpty(session.id)) showToast({ message: 'Empty workout cancelled' })
          }}
        />
        <input
          defaultValue={session.name ?? ''}
          key={session.id}
          placeholder={sessionTitle(session)}
          aria-label="Workout name"
          className="mt-1 w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-text"
          onBlur={(e) => {
            const name = e.target.value.trim() || null
            if (name !== session.name) void updateSession(session, { name })
          }}
        />
        <p className="text-sm text-muted">
          {active ? (
            <LiveDuration since={session.started_at} />
          ) : (
            formatDuration(session.started_at, session.ended_at)
          )}
          {' · '}
          {list.length} exercise{list.length === 1 ? '' : 's'} · {workingSets.length} sets
          {cardioList.length > 0 && ` · ${cardioList.length} cardio`}
        </p>
      </div>

      {list.length === 0 && cardioList.length === 0 && (
        <p className="rounded-2xl bg-surface p-6 text-center text-muted">
          Add your first exercise to get started.
        </p>
      )}

      {list.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Exercises</h2>
            {list.length > 1 && (
              <button
                type="button"
                className="h-8 rounded-full px-3 text-sm font-semibold text-accent"
                onClick={() => setReordering((r) => !r)}
              >
                {reordering ? 'Done' : 'Reorder'}
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-2">
            {list.map((se, i) => (
              <li key={se.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <SummaryCard
                    name={byId.get(se.exercise_id)?.name ?? 'Unknown exercise'}
                    logType={asLogType(byId.get(se.exercise_id)?.log_type)}
                    sets={allSets.filter((s) => s.session_exercise_id === se.id)}
                    planned={plannedFor(
                      se.plan_exercise_id,
                      asLogType(byId.get(se.exercise_id)?.log_type),
                    )}
                    notes={se.notes}
                    onOpen={() => {
                      if (!reordering) setOpenId(se.id)
                    }}
                  />
                </div>
                {reordering && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={i === 0}
                      onClick={() => void moveSessionExercise(list, i, -1)}
                      className="h-9 w-11 rounded-lg bg-surface text-lg disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={i === list.length - 1}
                      onClick={() => void moveSessionExercise(list, i, 1)}
                      className="h-9 w-11 rounded-lg bg-surface text-lg disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Button variant="secondary" onClick={() => setPicking(true)}>
        + Add exercise
      </Button>

      {cardioList.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Cardio</h2>
          <ul className="flex flex-col gap-2">
            {cardioList.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setCardioOpen(c)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left active:opacity-80"
                >
                  <span className="text-2xl">{cardioEmoji(c.activity)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold">
                      {cardioName(c.activity)}
                    </span>
                    <span className="block truncate text-sm text-muted">{cardioSummary(c)}</span>
                  </span>
                  <span className="text-2xl text-muted">›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={() => setCardioOpen('new')}
        className="h-12 rounded-xl border border-border text-base font-semibold text-muted active:bg-surface"
      >
        + Add cardio
      </button>

      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
          Workout notes
        </h2>
        <textarea
          defaultValue={session.notes ?? ''}
          key={`notes-${session.id}`}
          placeholder="How did it feel? Anything to remember next time?"
          rows={2}
          className="w-full resize-none rounded-2xl bg-surface p-4 outline-none"
          onBlur={(e) => {
            const notes = e.target.value.trim() || null
            if (notes !== session.notes) void updateSession(session, { notes })
          }}
        />
      </section>

      {active ? (
        <Button
          className="h-16 text-xl"
          disabled={list.length === 0 && cardioList.length === 0}
          onClick={async () => {
            await finishSession(session)
            showToast({ message: `Workout saved · ${workingSets.length} sets` })
            void navigate('/', { replace: true })
          }}
        >
          Save workout
        </Button>
      ) : (
        <p className="text-center text-sm text-muted">
          Saved{' '}
          {new Date(session.ended_at!).toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
          . You can still edit it.
        </p>
      )}
      <button type="button" className="h-12 text-danger" onClick={() => setConfirmDelete(true)}>
        Delete workout
      </button>

      <Sheet
        open={picking}
        title="Add exercise"
        subtitle="Search or filter by muscle, then tap an exercise."
        closeLabel="Cancel"
        onClose={() => setPicking(false)}
      >
        <ExerciseList
          recentFirst
          added={new Set(list.map((se) => se.exercise_id))}
          onPick={(e) => void pick(e)}
        />
        <Link
          to={`/exercises/new?addTo=${session.id}`}
          className="mt-4 flex h-12 items-center justify-center rounded-xl border border-dashed border-border font-semibold text-accent"
        >
          + Create custom exercise
        </Link>
      </Sheet>

      {open && (
        <ExerciseLogger
          key={open.id}
          se={open}
          exercise={byId.get(open.exercise_id)}
          sets={allSets.filter((s) => s.session_exercise_id === open.id)}
          onClose={() => setOpenId(null)}
        />
      )}

      {cardioOpen && (
        <CardioLogger
          key={cardioOpen === 'new' ? 'new' : cardioOpen.id}
          sessionId={session.id}
          existing={cardioOpen === 'new' ? undefined : cardioOpen}
          onClose={() => setCardioOpen(null)}
        />
      )}

      <Confirm
        open={confirmDelete}
        title="Delete this workout?"
        body="All its sets will be removed. You can undo straight after."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove(session)}
      />
    </div>
  )
}

function SummaryCard({
  name,
  logType,
  sets,
  planned,
  notes,
  onOpen,
}: {
  name: string
  logType: LogType
  sets: SetRow[]
  /** Plan target summary, e.g. "3 × 8–12 reps · RIR 1" */
  planned: string | null
  notes: string | null
  onOpen: () => void
}) {
  const working = sets.filter((s) => s.set_type !== 'warmup')
  const hasPR = sets.some((s) => s.is_pr)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left active:opacity-80"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-bold">
          {name}
          {hasPR && <span className="ml-2">🏆</span>}
        </span>
        <span className="block truncate text-sm text-muted">
          {working.length === 0
            ? planned
              ? `Planned: ${planned}`
              : 'No sets yet · tap to log'
            : `${working.length} set${working.length === 1 ? '' : 's'} · ${working
                .map((s) => formatSet(s, logType))
                .join(' · ')}`}
        </span>
        {notes && <span className="mt-0.5 block truncate text-xs text-muted">✎ {notes}</span>}
      </span>
      <span className="text-2xl text-muted">›</span>
    </button>
  )
}

function LiveDuration({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  return <>{formatDuration(since, null, now)}</>
}
