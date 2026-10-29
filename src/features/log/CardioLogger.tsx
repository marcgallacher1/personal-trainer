import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { Stepper } from '../../components/Stepper'
import { showToast } from '../../components/Toast'
import type { CardioEntry } from '../../db/queries'
import {
  CARDIO_GYM_CLASSES,
  CARDIO_GYM_MACHINES,
  CARDIO_LABELS,
  CARDIO_MAIN,
  cardioName,
  isMainCardio,
  type CardioActivity,
} from '../../lib/cardio'
import { deleteCardio, saveCardio, undoDeletion } from './actions'

interface Props {
  sessionId: string
  /** Edit this entry; omit to add a new one */
  existing?: CardioEntry
  onClose: () => void
}

/** Full-screen modal to add or edit one cardio entry. */
export function CardioLogger({ sessionId, existing, onClose }: Props) {
  const [activity, setActivity] = useState<CardioActivity>(
    (existing?.activity as CardioActivity | undefined) ?? 'run',
  )
  const [minutes, setMinutes] = useState(existing ? Math.round(existing.duration_seconds / 60) : 20)
  const [calories, setCalories] = useState(existing?.calories ?? 0)
  const [distance, setDistance] = useState(existing?.distance_km ?? 0)
  const [avgHr, setAvgHr] = useState(existing?.avg_hr ?? 0)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const otherSelected = !isMainCardio(activity)
  const [showOther, setShowOther] = useState(false)

  function pickOther(a: CardioActivity) {
    setActivity(a)
    setShowOther(false)
  }

  async function save() {
    await saveCardio(
      sessionId,
      {
        activity,
        duration_seconds: minutes * 60,
        calories: calories || null,
        distance_km: distance || null,
        avg_hr: avgHr || null,
        notes: notes.trim() || null,
      },
      existing,
    )
    showToast({ message: `✓ ${cardioName(activity)} saved` })
    onClose()
  }

  async function remove() {
    if (!existing) return
    const changes = await deleteCardio(existing)
    onClose()
    showToast({
      message: 'Cardio deleted',
      action: { label: 'Undo', onClick: () => void undoDeletion(changes) },
    })
  }

  return (
    <Sheet
      open
      title={existing ? 'Edit cardio' : 'Add cardio'}
      subtitle="Doesn’t count towards muscle volume."
      closeLabel="Cancel"
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={minutes <= 0}
          onClick={() => void save()}
          className="h-14 w-full rounded-2xl bg-accent text-lg font-bold text-accent-fg disabled:opacity-40"
        >
          {existing ? 'Save changes' : 'Save cardio'}
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Activity">
          <div className="grid grid-cols-5 gap-2">
            {CARDIO_MAIN.map((a) => (
              <ActivityTile
                key={a}
                emoji={CARDIO_LABELS[a].emoji}
                name={CARDIO_LABELS[a].name}
                selected={activity === a}
                onClick={() => {
                  setActivity(a)
                  setShowOther(false)
                }}
              />
            ))}
            <ActivityTile
              emoji="➕"
              name={otherSelected ? CARDIO_LABELS[activity].name : 'Other'}
              selected={otherSelected || showOther}
              onClick={() => setShowOther((s) => !s)}
            />
          </div>
        </Field>

        {showOther && (
          <div className="-mt-2 flex flex-col gap-3 rounded-2xl bg-surface p-3">
            <OtherGroup
              title="Gym machines"
              items={CARDIO_GYM_MACHINES}
              selected={activity}
              onPick={pickOther}
            />
            <OtherGroup
              title="Workouts & classes"
              items={CARDIO_GYM_CLASSES}
              selected={activity}
              onPick={pickOther}
            />
          </div>
        )}
        {activity === 'other' && !showOther && (
          <p className="-mt-3 text-xs text-muted">Describe it in the notes below.</p>
        )}

        <Field label="Duration (minutes)">
          <Stepper label="duration" value={minutes} step={5} min={0} onChange={setMinutes} />
        </Field>

        <Field label="Calories burned (kcal)" hint="From the machine or your watch. Optional.">
          <Stepper
            label="calories"
            value={calories}
            step={10}
            emptyLabel="–"
            onChange={setCalories}
          />
        </Field>

        <Field label="Distance (km)" hint="Optional.">
          <Stepper
            label="distance"
            value={distance}
            step={0.1}
            decimals
            emptyLabel="–"
            onChange={setDistance}
          />
        </Field>

        <Field label="Average heart rate (bpm)" hint="Optional.">
          <Stepper
            label="average heart rate"
            value={avgHr}
            step={1}
            emptyLabel="–"
            onChange={setAvgHr}
          />
        </Field>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Incline, level, intervals…"
            rows={2}
            className="w-full resize-none rounded-2xl bg-surface p-4 outline-none"
          />
        </Field>

        {existing && (
          <button
            type="button"
            className="h-12 font-semibold text-danger"
            onClick={() => void remove()}
          >
            Delete this cardio
          </button>
        )}
      </div>
    </Sheet>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{label}</h3>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </section>
  )
}

function ActivityTile({
  emoji,
  name,
  selected,
  onClick,
}: {
  emoji: string
  name: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex h-20 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-semibold ${
        selected ? 'bg-accent text-accent-fg' : 'bg-surface text-muted'
      }`}
    >
      <span className="text-2xl">{emoji}</span>
      <span className="w-full truncate text-center">{name}</span>
    </button>
  )
}

function OtherGroup({
  title,
  items,
  selected,
  onPick,
}: {
  title: string
  items: readonly CardioActivity[]
  selected: string
  onPick: (a: CardioActivity) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={selected === a}
            onClick={() => onPick(a)}
            className={`flex h-12 items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold ${
              selected === a ? 'bg-accent text-accent-fg' : 'bg-surface-2'
            }`}
          >
            <span className="text-lg">{CARDIO_LABELS[a].emoji}</span>
            <span className="truncate">{CARDIO_LABELS[a].name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
