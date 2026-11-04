import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { useExercises, type Exercise } from '../../db/queries'
import { asLogType } from '../../lib/logging/logTypes'
import type { CustomExercise } from '../../lib/plans/draft'
import { cardioEmoji, cardioName, detailsSummary, type PlannedCardio } from '../../lib/cardio'
import { CardioPlanSheet } from './PlanCardioSheet'
import { describeTargets } from '../../lib/plans/targets'
import { ExerciseList } from '../exercises/ExerciseList'
import { DayButtons } from './DayButtons'
import { defaultTargets } from './data'

export interface CustomCard {
  id: string
  /** Workout type it was made under (e.g. 'push'), or 'own' for "Create your own" */
  group: string
  name: string
  exercises: CustomExercise[]
  cardio: PlannedCardio[]
}

/** Your own workout in the plan builder: name, exercises, then day(s). */
export function CustomWorkoutCard({
  card,
  placeholder,
  nameLocked,
  cardioFirst = false,
  days,
  onChange,
  onToggleDay,
}: {
  card: CustomCard
  placeholder: string
  /** Already in a saved plan: rename it from the plan instead */
  nameLocked: boolean
  /** Cardio section: cardio is the main choice, weights the extra */
  cardioFirst?: boolean
  days: number[]
  onChange: (
    next: CustomCard,
    picked?: { exercise: Exercise; added: boolean } | { cardio: true },
  ) => void
  onToggleDay: (weekday: number) => void
}) {
  const library = useExercises()
  const [picking, setPicking] = useState(false)
  /** 'new' = adding cardio; a number = editing that item */
  const [cardioOpen, setCardioOpen] = useState<number | 'new' | null>(null)
  const byId = new Map((library ?? []).map((e) => [e.id, e]))
  const ready = card.name.trim() !== '' && (card.exercises.length > 0 || card.cardio.length > 0)
  const setCardio = (cardio: PlannedCardio[]) => onChange({ ...card, cardio }, { cardio: true })

  function pick(e: Exercise) {
    const has = card.exercises.some((x) => x.exerciseId === e.id)
    const exercises = has
      ? card.exercises.filter((x) => x.exerciseId !== e.id)
      : [...card.exercises, { exerciseId: e.id, targets: defaultTargets(e, asLogType(e.log_type)) }]
    onChange({ ...card, exercises }, { exercise: e, added: !has })
  }

  return (
    <section className="rounded-3xl border border-dashed border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="text-3xl">✏️</span>
        <div className="min-w-0 flex-1">
          <input
            value={card.name}
            disabled={nameLocked}
            onChange={(e) => onChange({ ...card, name: e.target.value })}
            placeholder={placeholder}
            aria-label="Workout name"
            className="w-full bg-transparent text-xl font-bold outline-none placeholder:text-muted disabled:opacity-100"
          />
          <p className="text-sm text-muted">
            {nameLocked
              ? 'In your plan — rename it from the plan.'
              : cardioFirst
                ? 'Your own cardio.'
                : 'Your own exercises.'}
          </p>
        </div>
      </div>

      {cardioFirst ? (
        <>
          {card.cardio.length > 0 && (
            <ul className="mt-3 flex flex-col gap-0.5 text-sm">
              {card.cardio.map((c, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setCardioOpen(i)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {cardioEmoji(c.activity)} {cardioName(c.activity)}
                    </span>
                    <span className="shrink-0 text-muted">
                      {[`${c.minutes} min`, detailsSummary(c.details ?? {})]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setCardioOpen('new')}
            className="mt-3 h-11 w-full rounded-xl bg-surface-2 font-semibold text-accent"
          >
            + {card.cardio.length ? 'Add more cardio' : 'Choose cardio'}
          </button>
          {card.exercises.length > 0 && (
            <ul className="mt-3 flex flex-col gap-0.5 text-sm">
              {card.exercises.map((ce) => {
                const ex = byId.get(ce.exerciseId)
                return (
                  <li key={ce.exerciseId} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate">{ex?.name ?? 'Exercise'}</span>
                    <span className="shrink-0 text-muted">
                      {describeTargets(ce.targets, asLogType(ex?.log_type))}
                    </span>
                    {ex && (
                      <button
                        type="button"
                        aria-label={`Remove ${ex.name}`}
                        onClick={() => pick(ex)}
                        className="-mr-2 h-8 w-8 shrink-0 text-lg text-muted"
                      >
                        ×
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setPicking(true)}
            className="mt-1 h-10 w-full text-sm font-semibold text-muted"
          >
            + Add weights
          </button>
        </>
      ) : (
        <>
          {card.exercises.length > 0 && (
            <ul className="mt-3 flex flex-col gap-0.5 text-sm">
              {card.exercises.map((ce) => {
                const ex = byId.get(ce.exerciseId)
                return (
                  <li key={ce.exerciseId} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate">{ex?.name ?? 'Exercise'}</span>
                    <span className="shrink-0 text-muted">
                      {describeTargets(ce.targets, asLogType(ex?.log_type))}
                    </span>
                    {ex && (
                      <button
                        type="button"
                        aria-label={`Remove ${ex.name}`}
                        onClick={() => pick(ex)}
                        className="-mr-2 h-8 w-8 shrink-0 text-lg text-muted"
                      >
                        ×
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setPicking(true)}
            className="mt-3 h-11 w-full rounded-xl bg-surface-2 font-semibold text-accent"
          >
            + {card.exercises.length ? 'Add more exercises' : 'Choose exercises'}
          </button>
          {card.cardio.length > 0 && (
            <ul className="mt-3 flex flex-col gap-0.5 text-sm">
              {card.cardio.map((c, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setCardioOpen(i)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {cardioEmoji(c.activity)} {cardioName(c.activity)}
                    </span>
                    <span className="shrink-0 text-muted">
                      {[`${c.minutes} min`, detailsSummary(c.details ?? {})]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setCardioOpen('new')}
            className="mt-1 h-10 w-full text-sm font-semibold text-muted"
          >
            + Add cardio
          </button>
        </>
      )}

      {ready ? (
        <DayButtons selected={days} onToggle={onToggleDay} />
      ) : (
        <p className="mt-3 text-center text-xs text-muted">
          {cardioFirst
            ? card.name.trim()
              ? 'Choose some cardio'
              : 'Name it and choose some cardio'
            : card.name.trim()
              ? 'Choose some exercises (or add cardio)'
              : 'Name it and choose some exercises (or add cardio)'}
          , then pick the day(s).
        </p>
      )}

      {cardioOpen !== null && (
        <CardioPlanSheet
          key={String(cardioOpen)}
          initial={cardioOpen === 'new' ? undefined : card.cardio[cardioOpen]}
          onSave={(c) =>
            setCardio(
              cardioOpen === 'new'
                ? [...card.cardio, c]
                : card.cardio.map((x, i) => (i === cardioOpen ? c : x)),
            )
          }
          onRemove={() => setCardio(card.cardio.filter((_, i) => i !== cardioOpen))}
          onClose={() => setCardioOpen(null)}
        />
      )}

      <Sheet
        open={picking}
        title="Choose exercises"
        subtitle="Tap to add, tap again to remove."
        closeLabel="Done"
        onClose={() => setPicking(false)}
      >
        <ExerciseList
          recentFirst
          added={new Set(card.exercises.map((x) => x.exerciseId))}
          onPick={pick}
        />
      </Sheet>
    </section>
  )
}
