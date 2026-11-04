import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { Stepper } from '../../components/Stepper'
import {
  cleanDetails,
  plannedCardio,
  type CardioActivity,
  type CardioDetails,
  type PlannedCardio,
} from '../../lib/cardio'
import type { PlanSessionRow } from '../../lib/plans/instantiate'
import { ActivityPicker, DetailsEditor } from '../log/CardioLogger'
import { updatePlanSession } from './data'

/** Pick an activity and minutes. With `initial`, it's an edit and offers Remove. */
export function CardioPlanSheet({
  initial,
  onSave,
  onRemove,
  onClose,
}: {
  initial?: PlannedCardio
  onSave: (c: PlannedCardio) => void | Promise<void>
  onRemove?: () => void | Promise<void>
  onClose: () => void
}) {
  const [activity, setActivity] = useState<CardioActivity>(initial?.activity ?? 'run')
  const [minutes, setMinutes] = useState(initial?.minutes ?? 20)
  const [details, setDetails] = useState<CardioDetails>(initial?.details ?? {})
  const planned = (): PlannedCardio => {
    const d = cleanDetails(activity, details)
    return Object.keys(d).length ? { activity, minutes, details: d } : { activity, minutes }
  }

  return (
    <Sheet
      open
      title={initial ? 'Edit cardio' : 'Add cardio'}
      subtitle="Speed, intervals and the rest are optional."
      closeLabel="Cancel"
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={minutes <= 0}
          onClick={() => void Promise.resolve(onSave(planned())).then(onClose)}
          className="h-14 w-full rounded-2xl bg-accent text-lg font-bold text-accent-fg disabled:opacity-40"
        >
          {initial ? 'Save changes' : 'Add to workout'}
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <ActivityPicker value={activity} onChange={setActivity} withNotes={false} />
        <section>
          <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
            Duration (minutes)
          </h3>
          <Stepper label="duration" value={minutes} step={5} min={0} onChange={setMinutes} />
        </section>
        <DetailsEditor activity={activity} value={details} onChange={setDetails} />
        {initial && onRemove && (
          <button
            type="button"
            className="h-12 font-semibold text-danger"
            onClick={() => void Promise.resolve(onRemove()).then(onClose)}
          >
            Remove from workout
          </button>
        )}
      </div>
    </Sheet>
  )
}

const asJson = (items: PlannedCardio[]) => items as unknown as PlanSessionRow['cardio_json']

/** Add (index = null) or edit one cardio item in a saved plan workout. */
export function PlanCardioSheet({
  session,
  index,
  onClose,
}: {
  session: PlanSessionRow
  index: number | null
  onClose: () => void
}) {
  const items = plannedCardio(session.cardio_json)
  return (
    <CardioPlanSheet
      initial={index === null ? undefined : items[index]}
      onSave={(c) =>
        updatePlanSession(session, {
          cardio_json: asJson(
            index === null ? [...items, c] : items.map((x, i) => (i === index ? c : x)),
          ),
        })
      }
      onRemove={() =>
        updatePlanSession(session, { cardio_json: asJson(items.filter((_, i) => i !== index)) })
      }
      onClose={onClose}
    />
  )
}
