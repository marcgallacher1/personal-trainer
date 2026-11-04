import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { Stepper } from '../../components/Stepper'
import { plannedCardio, type CardioActivity } from '../../lib/cardio'
import type { PlanSessionRow } from '../../lib/plans/instantiate'
import { ActivityPicker } from '../log/CardioLogger'
import { updatePlanSession } from './data'

/** Add (index = null) or edit one cardio item in a plan workout. */
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
  const existing = index === null ? undefined : items[index]
  const [activity, setActivity] = useState<CardioActivity>(existing?.activity ?? 'run')
  const [minutes, setMinutes] = useState(existing?.minutes ?? 20)

  async function save() {
    const item = { activity, minutes }
    const next = index === null ? [...items, item] : items.map((c, i) => (i === index ? item : c))
    await updatePlanSession(session, {
      cardio_json: next as unknown as PlanSessionRow['cardio_json'],
    })
    onClose()
  }

  async function remove() {
    const next = items.filter((_, i) => i !== index)
    await updatePlanSession(session, {
      cardio_json: next as unknown as PlanSessionRow['cardio_json'],
    })
    onClose()
  }

  return (
    <Sheet
      open
      title={existing ? 'Edit cardio' : 'Add cardio'}
      subtitle="Log the details on the day."
      closeLabel="Cancel"
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={minutes <= 0}
          onClick={() => void save()}
          className="h-14 w-full rounded-2xl bg-accent text-lg font-bold text-accent-fg disabled:opacity-40"
        >
          {existing ? 'Save changes' : 'Add to workout'}
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
        {existing && (
          <button
            type="button"
            className="h-12 font-semibold text-danger"
            onClick={() => void remove()}
          >
            Remove from workout
          </button>
        )}
      </div>
    </Sheet>
  )
}
