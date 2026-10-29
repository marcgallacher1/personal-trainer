import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../../components/Button'
import { Confirm } from '../../components/Confirm'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/Toast'
import {
  useExercises,
  useSession,
  useSessionExercises,
  useSessionSets,
  type Session,
} from '../../db/queries'
import { RIR_EXPLAINER } from '../../lib/logging/settings'
import { ExerciseList } from '../exercises/ExerciseList'
import {
  addExercise,
  deleteSession,
  finishSession,
  moveSessionExercise,
  undoDeletion,
  updateSession,
} from './actions'
import { ExerciseCard } from './ExerciseCard'
import { formatDuration, sessionTitle } from './format'

export function SessionScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useSession(id)
  const exercises = useSessionExercises(id)
  const sets = useSessionSets(id)
  const library = useExercises()
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
  const active = session.ended_at === null
  const workingSets = (sets ?? []).filter((s) => s.set_type !== 'warmup')

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
          {workingSets.length} sets
        </p>
        <p className="mt-2 text-xs text-muted">{RIR_EXPLAINER}</p>
      </div>

      {list.map((se, i) => (
        <ExerciseCard
          key={se.id}
          se={se}
          exercise={byId.get(se.exercise_id)}
          sets={(sets ?? []).filter((s) => s.session_exercise_id === se.id)}
          canMoveUp={i > 0}
          canMoveDown={i < list.length - 1}
          onMove={(dir) => void moveSessionExercise(list, i, dir)}
        />
      ))}

      <Button variant="secondary" onClick={() => setPicking(true)}>
        + Add exercise
      </Button>

      <textarea
        defaultValue={session.notes ?? ''}
        key={`notes-${session.id}`}
        placeholder="Workout notes"
        rows={2}
        className="w-full resize-none rounded-2xl bg-surface p-4 outline-none"
        onBlur={(e) => {
          const notes = e.target.value.trim() || null
          if (notes !== session.notes) void updateSession(session, { notes })
        }}
      />

      {active ? (
        <Button
          onClick={async () => {
            await finishSession(session)
            showToast({ message: `Workout saved · ${workingSets.length} sets` })
            void navigate('/log')
          }}
        >
          Finish workout
        </Button>
      ) : (
        <p className="text-center text-sm text-muted">
          Finished{' '}
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

      <Sheet open={picking} title="Add exercise" onClose={() => setPicking(false)}>
        <ExerciseList
          recentFirst
          added={new Set(list.map((se) => se.exercise_id))}
          onPick={(e) => {
            void addExercise(session.id, e)
            setPicking(false)
          }}
        />
        <Link
          to={`/exercises/new?addTo=${session.id}`}
          className="mt-4 flex h-12 items-center justify-center rounded-xl border border-dashed border-border font-semibold text-accent"
        >
          + Create custom exercise
        </Link>
      </Sheet>

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

function LiveDuration({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  return <>{formatDuration(since, null, now)}</>
}
