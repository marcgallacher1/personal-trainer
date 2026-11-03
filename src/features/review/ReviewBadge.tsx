import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { reviewWorkout, type WorkoutReview } from '../../lib/review/workout'
import { useTrainingData } from '../progress/data'

/** Reviews for finished workouts, worked out on demand (nothing stored). */
export function useReviews(): ((sessionId: string) => WorkoutReview | null) | undefined {
  const data = useTrainingData()
  if (!data) return undefined
  return (id) => {
    const session = data.sessions.find((s) => s.id === id)
    if (!session?.endedAt) return null
    return reviewWorkout({
      session,
      history: data.sessions,
      info: data.ctx.exercises,
      planned: data.planned.find((w) => w.id === session.planSessionId) ?? null,
    })
  }
}

export const scoreColour = (score: number): string =>
  score >= 85
    ? 'bg-success/15 text-success'
    : score >= 70
      ? 'bg-accent/15 text-accent'
      : score >= 55
        ? 'bg-warn/15 text-warn'
        : 'bg-danger/15 text-danger'

/** Small score pill. */
export function ScorePill({ score }: { score: number }) {
  return (
    <span
      className={`inline-flex h-6 min-w-9 items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums ${scoreColour(score)}`}
    >
      {score}
    </span>
  )
}

/** A tappable rating that opens the short review. */
export function ReviewButton({
  review,
  defaultOpen = false,
}: {
  review: WorkoutReview
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-surface py-1 pr-3 pl-1 text-sm font-semibold"
      >
        <ScorePill score={review.score} />
        Workout rating ›
      </button>
      <ReviewSheet review={review} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function ReviewSheet({
  review,
  open,
  onClose,
}: {
  review: WorkoutReview
  open: boolean
  onClose: () => void
}) {
  return (
    <Sheet
      open={open}
      title={review.verdict}
      subtitle="How this workout went"
      closeLabel="Done"
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold tabular-nums ${scoreColour(review.score)}`}
          >
            {review.score}
          </span>
          <p className="text-sm text-muted">
            Out of 100, based on progress vs last time, the plan, effort and volume.
          </p>
        </div>
        <Bullets title="Went well" items={review.good} icon="✓" />
        <Bullets title="Next time" items={review.improve} icon="→" />
      </div>
    </Sheet>
  )
}

function Bullets({ title, items, icon }: { title: string; items: string[]; icon: string }) {
  if (!items.length) return null
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((t) => (
          <li key={t} className="flex gap-2 rounded-xl bg-surface p-3 text-sm">
            <span className="font-bold text-accent">{icon}</span>
            {t}
          </li>
        ))}
      </ul>
    </section>
  )
}
