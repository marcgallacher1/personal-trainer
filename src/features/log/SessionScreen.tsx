import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { Confirm } from '../../components/Confirm'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/Toast'
import {
  useExercises,
  useSession,
  useSessionExercises,
  useSessionSets,
  type Exercise,
  type Session,
  type SetRow,
} from '../../db/queries'
import { ExerciseList } from '../exercises/ExerciseList'
import {
  addExercise,
  deleteSession,
  finishSession,
  moveSessionExercise,
  undoDeletion,
  updateSession,
} from './actions'
import { ExerciseLogger, kg } from './ExerciseLogger'
import { formatDuration, sessionTitle } from './format'

/** Workout overview: one summary card per exercise; tap a card to log it in a full-screen modal. */
export function SessionScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const session = useSession(id)
  const exercises = useSessionExercises(id)
  const sets = useSessionSets(id)
  const library = useExercises()
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
  const active = session.ended_at === null
  const workingSets = allSets.filter((s) => s.set_type !== 'warmup')
  const openIndex = list.findIndex((se) => se.id === openId)
  const open = openIndex >= 0 ? list[openIndex] : undefined

  async function pick(e: Exercise) {
    setPicking(false)
    const seId = await addExercise(session!.id, e)
    setOpenId(seId)
  }

  async function remove(s: Session) {
    setConfirmDelete(false)
    const changes = await deleteSession(s)
    void navigate('/log')
    showToast({
      message: 'Workout deleted',
      action: { label: 'Undo', onClick: () => void undoDeletion(changes) },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/log" className="text-sm text-accent">
          ‹ Log
        </Link>
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
        </p>
      </div>

      {list.length === 0 && (
        <p className="rounded-2xl bg-surface p-6 text-center text-muted">
          Add your first exercise to get started.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {list.map((se) => (
          <li key={se.id}>
            <SummaryCard
              name={byId.get(se.exercise_id)?.name ?? 'Unknown exercise'}
              sets={allSets.filter((s) => s.session_exercise_id === se.id)}
              notes={se.notes}
              onOpen={() => setOpenId(se.id)}
            />
          </li>
        ))}
      </ul>

      <Button variant="secondary" onClick={() => setPicking(true)}>
        + Add exercise
      </Button>

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
          disabled={list.length === 0}
          onClick={async () => {
            await finishSession(session)
            showToast({ message: `Workout saved · ${workingSets.length} sets` })
            void navigate('/log')
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
          canMoveUp={openIndex > 0}
          canMoveDown={openIndex < list.length - 1}
          onMove={(dir) => void moveSessionExercise(list, openIndex, dir)}
          onClose={() => setOpenId(null)}
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
  sets,
  notes,
  onOpen,
}: {
  name: string
  sets: SetRow[]
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
            ? 'No sets yet · tap to log'
            : `${working.length} set${working.length === 1 ? '' : 's'} · ${working
                .map((s) => `${kg(s.weight_kg)}×${s.reps}`)
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
