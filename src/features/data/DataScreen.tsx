import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { RangeTabs } from '../../components/charts/ChartCard'
import { Confirm } from '../../components/Confirm'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/Toast'
import { db } from '../../db/local'
import {
  useExerciseMuscleMap,
  useExercises,
  useMuscles,
  type Exercise,
  type Session,
  type SetRow,
} from '../../db/queries'
import { rangeStart, type RangeId } from '../../lib/analysis/training'
import { importSets, SET_COLUMNS, toCsv, type Cell, type ImportedWorkout } from '../../lib/data/csv'
import { asLogType } from '../../lib/logging/logTypes'
import { isTimed } from '../../lib/logging/types'
import { EQUIPMENT_LABELS, label } from '../../lib/seed/labels'
import { deleteSession, deleteSet, undoDeletion, updateSession, updateSet } from '../log/actions'
import { londonDate } from '../log/format'
import { exportEverything, importWorkouts, saveFile } from './actions'

type Tab = 'workouts' | 'sets' | 'exercises'
const PAGE = 100
const live = (r: { deleted_at: string | null }) => r.deleted_at === null
const londonTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))

interface Column<T> {
  id: string
  label: string
  value: (row: T) => Cell
  numeric?: boolean
}

/** Raw tables of everything logged: search, filter, sort, edit, delete, export and import. */
export function DataScreen() {
  const navigate = useNavigate()
  const exercises = useExercises()
  const muscles = useMuscles()
  const muscleMap = useExerciseMuscleMap()
  const rows = useLiveQuery(async () => {
    const [sessions, sets] = await Promise.all([db.sessions.toArray(), db.sets.toArray()])
    return {
      sessions: sessions.filter(live),
      sets: sets.filter(live),
      today: londonDate(new Date().toISOString()),
    }
  }, [])
  const [tab, setTab] = useState<Tab>('sets')
  const [query, setQuery] = useState('')
  const [range, setRange] = useState<RangeId>('all')
  const [muscle, setMuscle] = useState('')
  const [sort, setSort] = useState<{ id: string; desc: boolean }>({ id: 'date', desc: true })
  const [limit, setLimit] = useState(PAGE)
  const [editingSet, setEditingSet] = useState<SetRow | null>(null)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [pending, setPending] = useState<{ workouts: ImportedWorkout[]; errors: string[] } | null>(
    null,
  )
  const fileInput = useRef<HTMLInputElement>(null)

  if (!rows || !exercises || !muscles || !muscleMap) return null

  const exById = new Map(exercises.map((e) => [e.id, e]))
  const sessionById = new Map(rows.sessions.map((s) => [s.id, s]))
  // '' sorts before every date, so 'All' keeps everything
  const from = rangeStart(range, rows.today, '')
  const q = query.trim().toLowerCase()
  const hitsMuscle = (exerciseId: string) =>
    !muscle ||
    (muscleMap.get(exerciseId) ?? []).some((m) => m.muscle_id === muscle && Number(m.weight) >= 1)
  const exName = (id: string) => exById.get(id)?.name ?? 'Unknown exercise'

  const setCols: Column<SetRow>[] = [
    {
      id: 'date',
      label: 'Date',
      value: (s) => londonDate(sessionById.get(s.session_id)?.started_at ?? s.completed_at),
    },
    { id: 'exercise', label: 'Exercise', value: (s) => exName(s.exercise_id) },
    { id: 'weight', label: 'kg', value: (s) => Number(s.weight_kg), numeric: true },
    {
      id: 'reps',
      label: 'Reps',
      value: (s) =>
        isTimed(asLogType(exById.get(s.exercise_id)?.log_type))
          ? `${s.duration_seconds ?? 0}s`
          : s.reps,
      numeric: true,
    },
    { id: 'rir', label: 'RIR', value: (s) => s.rir, numeric: true },
    { id: 'type', label: 'Type', value: (s) => (s.set_type === 'working' ? '' : s.set_type) },
  ]
  const sessionCols: Column<Session>[] = [
    { id: 'date', label: 'Date', value: (s) => londonDate(s.started_at) },
    { id: 'name', label: 'Workout', value: (s) => s.name ?? 'Workout' },
    {
      id: 'sets',
      label: 'Sets',
      value: (s) =>
        rows.sets.filter((x) => x.session_id === s.id && x.set_type !== 'warmup').length,
      numeric: true,
    },
    {
      id: 'mins',
      label: 'Mins',
      value: (s) =>
        s.ended_at
          ? Math.round((Date.parse(s.ended_at) - Date.parse(s.started_at)) / 60_000)
          : null,
      numeric: true,
    },
  ]
  const exerciseCols: Column<Exercise>[] = [
    { id: 'name', label: 'Exercise', value: (e) => e.name },
    { id: 'equipment', label: 'Kit', value: (e) => label(EQUIPMENT_LABELS, e.equipment) },
    {
      id: 'sets',
      label: 'Sets',
      value: (e) => rows.sets.filter((x) => x.exercise_id === e.id).length,
      numeric: true,
    },
  ]

  const sorted = <T,>(list: T[], cols: Column<T>[]) => {
    const col = cols.find((c) => c.id === sort.id) ?? cols[0]!
    return list.toSorted((a, b) => {
      const va = col.value(a) ?? ''
      const vb = col.value(b) ?? ''
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb))
      return sort.desc ? -cmp : cmp
    })
  }

  const sets = sorted(
    rows.sets.filter((s) => {
      const session = sessionById.get(s.session_id)
      if (!session || londonDate(session.started_at) < from) return false
      if (!hitsMuscle(s.exercise_id)) return false
      return (
        !q ||
        exName(s.exercise_id).toLowerCase().includes(q) ||
        (session.name ?? '').toLowerCase().includes(q)
      )
    }),
    setCols,
  )
  const sessions = sorted(
    rows.sessions.filter(
      (s) =>
        londonDate(s.started_at) >= from && (!q || (s.name ?? 'workout').toLowerCase().includes(q)),
    ),
    sessionCols,
  )
  const exerciseRows = sorted(
    exercises.filter((e) => hitsMuscle(e.id) && (!q || e.name.toLowerCase().includes(q))),
    exerciseCols,
  )

  async function exportView() {
    const csv =
      tab === 'sets'
        ? toCsv(
            SET_COLUMNS,
            sets.map((s) => {
              const session = sessionById.get(s.session_id)!
              return [
                londonDate(session.started_at),
                londonTime(session.started_at),
                session.name ?? 'Workout',
                exName(s.exercise_id),
                s.set_type,
                Number(s.weight_kg),
                s.reps,
                s.duration_seconds,
                s.rir,
              ]
            }),
          )
        : tab === 'workouts'
          ? toCsv(
              sessionCols.map((c) => c.label),
              sessions.map((s) => sessionCols.map((c) => c.value(s))),
            )
          : toCsv(
              exerciseCols.map((c) => c.label),
              exerciseRows.map((e) => exerciseCols.map((c) => c.value(e))),
            )
    await saveFile(`trainer-${tab}-${rows!.today}.csv`, 'text/csv', csv)
  }

  async function onFile(file: File) {
    const text = await file.text()
    setPending(importSets(text, new Map(exercises!.map((e) => [e.name, e.id]))))
  }

  function header<T>(cols: Column<T>[]) {
    return (
      <tr>
        {cols.map((c) => (
          <th
            key={c.id}
            className={`px-2 py-2 font-semibold ${c.numeric ? 'text-right' : 'text-left'}`}
          >
            <button
              type="button"
              onClick={() =>
                setSort((s) => ({
                  id: c.id,
                  desc: s.id === c.id ? !s.desc : Boolean(c.numeric),
                }))
              }
              className="inline-flex items-center gap-0.5"
            >
              {c.label}
              {sort.id === c.id && <span aria-hidden>{sort.desc ? '↓' : '↑'}</span>}
            </button>
          </th>
        ))}
      </tr>
    )
  }

  function body<T extends { id: string }>(list: T[], cols: Column<T>[], onTap: (row: T) => void) {
    return list.slice(0, limit).map((r) => (
      <tr key={r.id} onClick={() => onTap(r)} className="cursor-pointer active:bg-surface-2">
        {cols.map((c, i) => (
          <td
            key={c.id}
            className={`px-2 py-2 ${c.numeric ? 'text-right tabular-nums' : ''} ${i === 1 ? 'max-w-40 truncate' : 'whitespace-nowrap'}`}
          >
            {c.value(r) ?? ''}
          </td>
        ))}
      </tr>
    ))
  }

  const count =
    tab === 'sets' ? sets.length : tab === 'workouts' ? sessions.length : exerciseRows.length

  return (
    <div className="flex flex-col gap-3">
      <BackButton fallback="/more" label="More" />
      <h1 className="text-3xl font-bold tracking-tight">Data</h1>

      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
        {(['sets', 'workouts', 'exercises'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t)
              setLimit(PAGE)
              setSort({ id: t === 'exercises' ? 'name' : 'date', desc: t !== 'exercises' })
            }}
            className={`h-10 rounded-lg text-sm font-semibold capitalize ${tab === t ? 'bg-surface text-text shadow' : 'text-muted'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tab === 'workouts' ? 'Search workouts' : 'Search exercises or workouts'}
        className="h-12 rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
      />
      {tab !== 'exercises' && <RangeTabs value={range} onChange={setRange} />}
      {tab !== 'workouts' && (
        <select
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
          aria-label="Filter by muscle"
          className="h-11 rounded-xl border border-border bg-surface px-3"
        >
          <option value="">All muscles</option>
          {muscles.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {count} {tab === 'sets' ? 'set' : tab === 'workouts' ? 'workout' : 'exercise'}
          {count === 1 ? '' : 's'} · tap a row to {tab === 'exercises' ? 'open' : 'edit'}
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            {tab === 'sets'
              ? header(setCols)
              : tab === 'workouts'
                ? header(sessionCols)
                : header(exerciseCols)}
          </thead>
          <tbody className="divide-y divide-border">
            {tab === 'sets'
              ? body(sets, setCols, setEditingSet)
              : tab === 'workouts'
                ? body(sessions, sessionCols, setEditingSession)
                : body(exerciseRows, exerciseCols, (e) => void navigate(`/exercises/${e.id}`))}
          </tbody>
        </table>
        {count === 0 && <p className="p-6 text-center text-muted">Nothing matches.</p>}
      </div>
      {count > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="h-11 font-semibold text-accent"
        >
          Show {Math.min(PAGE, count - limit)} more
        </button>
      )}

      <section className="mt-2 flex flex-col gap-2 rounded-2xl bg-surface p-4">
        <h2 className="font-bold">Export & import</h2>
        <button
          type="button"
          onClick={() => void exportView()}
          className="h-11 rounded-xl bg-surface-2 font-semibold"
        >
          Export this view (CSV)
        </button>
        <button
          type="button"
          onClick={async () =>
            saveFile(
              `trainer-backup-${rows.today}.json`,
              'application/json',
              await exportEverything(),
            )
          }
          className="h-11 rounded-xl bg-surface-2 font-semibold"
        >
          Export everything (JSON)
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="h-11 rounded-xl bg-surface-2 font-semibold"
        >
          Import sets (CSV)
        </button>
        <p className="text-xs text-muted">
          Import uses the same columns as a sets export: date, time, workout, exercise, set_type,
          weight_kg, reps, seconds, rir. Only date, exercise and reps are required.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
            e.target.value = ''
          }}
        />
      </section>

      {editingSet && (
        <SetSheet
          set={editingSet}
          exercise={exById.get(editingSet.exercise_id)}
          session={sessionById.get(editingSet.session_id)}
          onClose={() => setEditingSet(null)}
        />
      )}
      {editingSession && (
        <SessionSheet session={editingSession} onClose={() => setEditingSession(null)} />
      )}
      {pending && (
        <Sheet open title="Import sets" closeLabel="Cancel" onClose={() => setPending(null)}>
          <div className="flex flex-col gap-3">
            <p>
              {pending.workouts.length
                ? `Ready to add ${pending.workouts.reduce((a, w) => a + w.sets.length, 0)} sets in ${pending.workouts.length} workout${pending.workouts.length === 1 ? '' : 's'}.`
                : 'Nothing to import.'}
            </p>
            {pending.errors.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-xl bg-danger/10 p-3 text-sm text-danger">
                <p className="font-semibold">
                  {pending.errors.length} row{pending.errors.length === 1 ? '' : 's'} skipped:
                </p>
                <ul>
                  {pending.errors.slice(0, 50).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              disabled={!pending.workouts.length}
              onClick={async () => {
                const n = await importWorkouts(pending.workouts)
                setPending(null)
                showToast({ message: `Imported ${n} sets` })
              }}
              className="h-14 rounded-2xl bg-accent text-lg font-bold text-accent-fg disabled:opacity-40"
            >
              Import
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

function SetSheet({
  set,
  exercise,
  session,
  onClose,
}: {
  set: SetRow
  exercise: Exercise | undefined
  session: Session | undefined
  onClose: () => void
}) {
  const timed = isTimed(asLogType(exercise?.log_type))
  const [weight, setWeight] = useState(String(Number(set.weight_kg)))
  const [reps, setReps] = useState(String(timed ? (set.duration_seconds ?? 0) : set.reps))
  const [rir, setRir] = useState(set.rir === null ? '' : String(set.rir))
  const [type, setType] = useState(set.set_type)
  const [confirm, setConfirm] = useState(false)
  const valid =
    Number(weight) >= 0 &&
    Number.isInteger(Number(reps)) &&
    Number(reps) >= 0 &&
    (rir === '' || (Number.isInteger(Number(rir)) && Number(rir) <= 10))

  return (
    <Sheet
      open
      title={exercise?.name ?? 'Set'}
      subtitle={
        session ? `${session.name ?? 'Workout'} · ${londonDate(session.started_at)}` : undefined
      }
      closeLabel="Cancel"
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Weight (kg)" value={weight} onChange={setWeight} decimal />
          <Field label={timed ? 'Seconds' : 'Reps'} value={reps} onChange={setReps} />
          <Field label="RIR" value={rir} onChange={setRir} />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Set type"
          className="h-12 rounded-xl border border-border bg-surface px-3"
        >
          <option value="working">Working set</option>
          <option value="warmup">Warm-up</option>
          <option value="drop">Drop set</option>
          <option value="failure">To failure</option>
        </select>
        <button
          type="button"
          disabled={!valid}
          onClick={async () => {
            await updateSet(set, {
              weight_kg: Number(weight),
              ...(timed ? { duration_seconds: Number(reps) } : { reps: Number(reps) }),
              rir: rir === '' ? null : Number(rir),
              set_type: type,
            })
            onClose()
            showToast({ message: 'Set updated' })
          }}
          className="h-14 rounded-2xl bg-accent text-lg font-bold text-accent-fg disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="h-12 font-semibold text-danger"
        >
          Delete set
        </button>
      </div>
      <Confirm
        open={confirm}
        title="Delete this set?"
        confirmLabel="Delete"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          const changes = await deleteSet(set)
          onClose()
          showToast({
            message: 'Set deleted',
            action: { label: 'Undo', onClick: () => void undoDeletion(changes) },
          })
        }}
      />
    </Sheet>
  )
}

function SessionSheet({ session, onClose }: { session: Session; onClose: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState(session.name ?? '')
  const [confirm, setConfirm] = useState(false)
  return (
    <Sheet
      open
      title="Workout"
      subtitle={`${londonDate(session.started_at)} · ${londonTime(session.started_at)}`}
      closeLabel="Cancel"
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workout"
            className="h-12 rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
          />
        </label>
        <button
          type="button"
          onClick={async () => {
            await updateSession(session, { name: name.trim() || null })
            onClose()
            showToast({ message: 'Workout updated' })
          }}
          className="h-14 rounded-2xl bg-accent text-lg font-bold text-accent-fg"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => void navigate(`/log/session/${session.id}`)}
          className="h-12 rounded-xl bg-surface-2 font-semibold"
        >
          Open workout
        </button>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="h-12 font-semibold text-danger"
        >
          Delete workout
        </button>
      </div>
      <Confirm
        open={confirm}
        title="Delete this workout?"
        body="All its sets are deleted too."
        confirmLabel="Delete"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          const changes = await deleteSession(session)
          onClose()
          showToast({
            message: 'Workout deleted',
            action: { label: 'Undo', onClick: () => void undoDeletion(changes) },
          })
        }}
      />
    </Sheet>
  )
}

function Field({
  label: text,
  value,
  onChange,
  decimal = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  decimal?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted">{text}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={decimal ? 'decimal' : 'numeric'}
        className="h-12 rounded-xl border border-border bg-surface px-3 text-lg tabular-nums outline-none focus:border-accent"
      />
    </label>
  )
}
