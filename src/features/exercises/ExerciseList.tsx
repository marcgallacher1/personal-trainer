import { useMemo, useState } from 'react'
import {
  useExerciseMuscleMap,
  useExercises,
  useLastUsed,
  useMuscles,
  type Exercise,
} from '../../db/queries'
import { EQUIPMENT_LABELS, label } from '../../lib/seed/labels'

interface Props {
  onPick: (e: Exercise) => void
  /** Show a "Recent" section (picker) vs. plain A–Z (library). */
  recentFirst?: boolean
  /** Exercise IDs to mark as already added */
  added?: ReadonlySet<string>
}

/** Searchable, muscle-filterable exercise list shared by the picker and the library. */
export function ExerciseList({ onPick, recentFirst = false, added }: Props) {
  const exercises = useExercises()
  const muscles = useMuscles()
  const muscleMap = useExerciseMuscleMap()
  const lastUsed = useLastUsed()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)

  const { recent, rest } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = (exercises ?? []).filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false
      if (muscle) {
        // Filter on primary movers, so "Biceps" doesn't list every row.
        const primaries = (muscleMap?.get(e.id) ?? []).filter((m) => m.weight >= 1)
        if (!primaries.some((m) => m.muscle_id === muscle)) return false
      }
      return true
    })
    if (!recentFirst || q || !lastUsed) return { recent: [], rest: matches }
    const recentList = matches
      .filter((e) => lastUsed.has(e.id))
      .toSorted((a, b) => lastUsed.get(b.id)!.localeCompare(lastUsed.get(a.id)!))
      .slice(0, 8)
    const recentIds = new Set(recentList.map((e) => e.id))
    return { recent: recentList, rest: matches.filter((e) => !recentIds.has(e.id)) }
  }, [exercises, muscleMap, lastUsed, query, muscle, recentFirst])

  const muscleName = (id: string) => muscles?.find((m) => m.id === id)?.name ?? id

  const row = (e: Exercise) => {
    const primaries = (muscleMap?.get(e.id) ?? [])
      .filter((m) => m.weight >= 1)
      .map((m) => muscleName(m.muscle_id))
    const isAdded = added?.has(e.id)
    return (
      <li key={e.id}>
        <button
          type="button"
          onClick={() => onPick(e)}
          className="flex min-h-14 w-full items-center gap-3 border-b border-border py-2 text-left active:bg-surface"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">
              {e.name}
              {e.is_custom && <span className="ml-2 text-xs font-normal text-accent">custom</span>}
            </span>
            <span className="block truncate text-xs text-muted">
              {primaries.join(', ')} · {label(EQUIPMENT_LABELS, e.equipment)}
            </span>
          </span>
          {isAdded && <span className="text-xs text-muted">added</span>}
        </button>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        placeholder="Search exercises"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-12 rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
      />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={muscle === null} onClick={() => setMuscle(null)}>
          All
        </Chip>
        {(muscles ?? []).map((m) => (
          <Chip
            key={m.id}
            active={muscle === m.id}
            onClick={() => setMuscle(muscle === m.id ? null : m.id)}
          >
            {m.name}
          </Chip>
        ))}
      </div>

      {recent.length > 0 && (
        <>
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Recent</h3>
          <ul>{recent.map(row)}</ul>
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
            All exercises
          </h3>
        </>
      )}
      <ul>{rest.map(row)}</ul>
      {exercises && rest.length === 0 && recent.length === 0 && (
        <p className="py-6 text-center text-muted">No exercises match.</p>
      )}
    </div>
  )
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-9 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap ${
        active ? 'bg-accent text-accent-fg' : 'bg-surface text-muted'
      }`}
    >
      {children}
    </button>
  )
}
