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
  cardioDetails,
  cleanDetails,
  detailFields,
  detailsSummary,
  swimKm,
  type CardioActivity,
  type CardioDetails,
  type PlannedCardio,
} from '../../lib/cardio'
import { deleteCardio, saveCardio, undoDeletion } from './actions'

interface Props {
  sessionId: string
  /** Edit this entry; omit to add a new one */
  existing?: CardioEntry
  /** Starting values for a new entry, e.g. the plan's cardio */
  preset?: PlannedCardio
  onClose: () => void
}

/** Full-screen modal to add or edit one cardio entry. */
export function CardioLogger({ sessionId, existing, preset, onClose }: Props) {
  const [activity, setActivity] = useState<CardioActivity>(
    (existing?.activity as CardioActivity | undefined) ?? preset?.activity ?? 'run',
  )
  const [minutes, setMinutes] = useState(
    existing ? Math.round(existing.duration_seconds / 60) : (preset?.minutes ?? 20),
  )
  const [calories, setCalories] = useState(existing?.calories ?? 0)
  const [distance, setDistance] = useState(existing?.distance_km ?? 0)
  const [avgHr, setAvgHr] = useState(existing?.avg_hr ?? 0)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [details, setDetails] = useState<CardioDetails>(() =>
    existing ? cardioDetails(existing.details_json) : (preset?.details ?? {}),
  )
  const kept = cleanDetails(activity, details)
  async function save() {
    await saveCardio(
      sessionId,
      {
        activity,
        duration_seconds: minutes * 60,
        calories: calories || null,
        // Swims work out their distance from the pool
        distance_km: distance || swimKm(kept) || null,
        avg_hr: avgHr || null,
        notes: notes.trim() || null,
        details_json: kept as CardioEntry['details_json'],
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
        <ActivityPicker value={activity} onChange={setActivity} />

        <Field label="Duration (minutes)">
          <Stepper label="duration" value={minutes} step={5} min={0} onChange={setMinutes} />
        </Field>

        <DetailsEditor activity={activity} value={details} onChange={setDetails} />

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

/** Run, walk, cycle, swim tiles, plus "Other" for gym machines and classes. */
export function ActivityPicker({
  value,
  onChange,
  withNotes = true,
}: {
  value: CardioActivity
  onChange: (a: CardioActivity) => void
  /** Says to describe "Something else" in the notes */
  withNotes?: boolean
}) {
  const otherSelected = !isMainCardio(value)
  const [showOther, setShowOther] = useState(false)
  function pickOther(a: CardioActivity) {
    onChange(a)
    setShowOther(false)
  }
  return (
    <>
      <Field label="Activity">
        <div className="grid grid-cols-5 gap-2">
          {CARDIO_MAIN.map((a) => (
            <ActivityTile
              key={a}
              emoji={CARDIO_LABELS[a].emoji}
              name={CARDIO_LABELS[a].name}
              selected={value === a}
              onClick={() => {
                onChange(a)
                setShowOther(false)
              }}
            />
          ))}
          <ActivityTile
            emoji="➕"
            name={otherSelected ? CARDIO_LABELS[value].name : 'Other'}
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
            selected={value}
            onPick={pickOther}
          />
          <OtherGroup
            title="Workouts & classes"
            items={CARDIO_GYM_CLASSES}
            selected={value}
            onPick={pickOther}
          />
        </div>
      )}
      {value === 'other' && !showOther && withNotes && (
        <p className="-mt-3 text-xs text-muted">Describe it in the notes below.</p>
      )}
    </>
  )
}

const POOLS = [25, 50]
const n = (x: number | undefined) => x ?? 0

/** Optional extras for the activity: speed, incline, level, intervals, or pool and lengths. */
export function DetailsEditor({
  activity,
  value,
  onChange,
}: {
  activity: string
  value: CardioDetails
  onChange: (d: CardioDetails) => void
}) {
  const fields = detailFields(activity)
  const has = (f: string) => fields.includes(f as never)
  const filled = Object.keys(cleanDetails(activity, value)).length > 0
  const [open, setOpen] = useState(filled)
  const [otherPool, setOtherPool] = useState(
    value.poolLengthM !== undefined && !POOLS.includes(value.poolLengthM),
  )
  const set = (patch: CardioDetails) => onChange({ ...value, ...patch })
  if (!fields.length) return null

  // Swimming: pool and lengths are the main thing, so always shown
  const pool = has('pool') && (
    <>
      <Field label="Pool length">
        <div className="grid grid-cols-3 gap-2">
          {POOLS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={!otherPool && value.poolLengthM === m}
              onClick={() => {
                setOtherPool(false)
                set({ poolLengthM: value.poolLengthM === m ? undefined : m })
              }}
              className={`h-12 rounded-xl font-semibold ${
                !otherPool && value.poolLengthM === m
                  ? 'bg-accent text-accent-fg'
                  : 'bg-surface text-muted'
              }`}
            >
              {m} m
            </button>
          ))}
          <button
            type="button"
            aria-pressed={otherPool}
            onClick={() => setOtherPool((o) => !o)}
            className={`h-12 rounded-xl font-semibold ${
              otherPool ? 'bg-accent text-accent-fg' : 'bg-surface text-muted'
            }`}
          >
            Other
          </button>
        </div>
        {otherPool && (
          <div className="mt-2">
            <Stepper
              label="pool length in metres"
              value={n(value.poolLengthM)}
              step={1}
              emptyLabel="–"
              onChange={(v) => set({ poolLengthM: v })}
            />
          </div>
        )}
      </Field>
      <Field
        label="Lengths"
        hint={swimKm(value) ? `That's ${swimKm(value)} km.` : 'Optional. Gives your distance.'}
      >
        <Stepper
          label="lengths"
          value={n(value.lengths)}
          step={2}
          emptyLabel="–"
          onChange={(v) => set({ lengths: v })}
        />
      </Field>
    </>
  )

  const extras = fields.filter((f) => f !== 'pool')
  const extraNames: Record<string, string> = {
    speed: 'speed',
    incline: 'incline',
    level: 'level',
    intervals: 'intervals',
  }

  const extrasLabel = extras.map((f) => extraNames[f]).join(', ')
  // What's set but hidden, so nothing is saved out of sight
  const hiddenSummary = detailsSummary(
    cleanDetails(activity, { ...value, poolLengthM: undefined, lengths: undefined }),
  )

  return (
    <>
      {pool}
      {extras.length > 0 && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="-mt-2 h-10 self-start text-left text-sm font-semibold text-accent"
        >
          {open ? '−' : '+'} {open ? 'Hide' : 'Add'} {extrasLabel}
          {!open && hiddenSummary && (
            <span className="font-normal text-muted"> · {hiddenSummary}</span>
          )}
        </button>
      )}
      {extras.length > 0 && open && (
        <>
          {has('speed') && (
            <Field label="Speed (km/h)" hint="Optional. From the treadmill or your watch.">
              <Stepper
                label="speed"
                value={n(value.speedKmh)}
                step={0.5}
                decimals
                emptyLabel="–"
                onChange={(v) => set({ speedKmh: v })}
              />
            </Field>
          )}
          {has('incline') && (
            <Field label="Incline (%)" hint="Optional.">
              <Stepper
                label="incline"
                value={n(value.inclinePct)}
                step={0.5}
                decimals
                emptyLabel="–"
                onChange={(v) => set({ inclinePct: v })}
              />
            </Field>
          )}
          {has('level') && (
            <Field label="Level / resistance" hint="Optional. The number on the machine.">
              <Stepper
                label="level"
                value={n(value.level)}
                step={1}
                emptyLabel="–"
                onChange={(v) => set({ level: v })}
              />
            </Field>
          )}
          {has('intervals') && (
            <Field label="Intervals" hint="Optional. E.g. 6 rounds of 1 min hard, 90 s easy.">
              <div className={`grid grid-cols-3 gap-2 ${has('speed') ? 'grid-rows-2' : ''}`}>
                <IntervalBox
                  label="Rounds"
                  value={n(value.rounds)}
                  step={1}
                  tall={has('speed')}
                  onChange={(v) => set({ rounds: v })}
                />
                <IntervalBox
                  label="Hard (sec)"
                  value={n(value.workSeconds)}
                  step={15}
                  onChange={(v) => set({ workSeconds: v })}
                />
                {has('speed') && (
                  <IntervalBox
                    label="Hard (km/h)"
                    value={n(value.hardSpeedKmh)}
                    step={0.5}
                    decimals
                    onChange={(v) => set({ hardSpeedKmh: v })}
                  />
                )}
                <IntervalBox
                  label="Easy (sec)"
                  value={n(value.restSeconds)}
                  step={15}
                  onChange={(v) => set({ restSeconds: v })}
                />
                {has('speed') && (
                  <IntervalBox
                    label="Easy (km/h)"
                    value={n(value.easySpeedKmh)}
                    step={0.5}
                    decimals
                    onChange={(v) => set({ easySpeedKmh: v })}
                  />
                )}
              </div>
            </Field>
          )}
        </>
      )}
    </>
  )
}

/** A small number box for interval rounds, seconds or speed. */
function IntervalBox({
  label,
  value,
  step,
  decimals = false,
  tall = false,
  onChange,
}: {
  label: string
  value: number
  step: number
  /** Allow one decimal place (speeds) */
  decimals?: boolean
  /** Fill two rows (Rounds next to the hard and easy rows) */
  tall?: boolean
  onChange: (v: number) => void
}) {
  const tidy = (v: number) =>
    Math.max(0, Math.min(3600, decimals ? Math.round(v * 10) / 10 : Math.round(v)))
  return (
    <label
      className={`flex flex-col items-center gap-1 rounded-xl bg-surface p-2 ${
        tall ? 'row-span-2 justify-center' : ''
      }`}
    >
      <span className="text-xs font-semibold text-muted">{label}</span>
      <input
        inputMode={decimals ? 'decimal' : 'numeric'}
        value={value || ''}
        placeholder="–"
        onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(tidy(Number(e.target.value) || 0))}
        className="h-10 w-full bg-transparent text-center text-xl font-bold tabular-nums outline-none"
      />
      <span className="flex gap-1">
        <button
          type="button"
          aria-label={`Less ${label}`}
          onClick={() => onChange(tidy(value - step))}
          className="h-8 w-8 rounded-lg bg-surface-2 font-bold"
        >
          −
        </button>
        <button
          type="button"
          aria-label={`More ${label}`}
          onClick={() => onChange(tidy(value + step))}
          className="h-8 w-8 rounded-lg bg-surface-2 font-bold"
        >
          +
        </button>
      </span>
    </label>
  )
}
