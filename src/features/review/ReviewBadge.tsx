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

/** Score pill: tells you a workout has a rating. */
export function ScorePill({ score, large = false }: { score: number; large?: boolean }) {
  return (
    <span
      aria-label={`Rated ${score} out of 100`}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums ${scoreColour(score)} ${
        large ? 'h-9 min-w-12 px-3 text-base' : 'h-6 min-w-9 px-2 text-xs'
      }`}
    >
      {score}
    </span>
  )
}

/** The review, shown at the top of a saved workout. */
export function ReviewCard({ review }: { review: WorkoutReview }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold tabular-nums ${scoreColour(review.score)}`}
        >
          {review.score}
        </span>
        <span className="min-w-0">
          <span className="block text-lg font-bold">{review.verdict}</span>
          <span className="block text-xs text-muted">
            Starts at 100. Anything that cost points is listed below.
          </span>
        </span>
      </div>
      <Bullets title="Went well" items={review.good} icon="✓" />
      <Bullets title="To work on" items={review.improve} icon="→" />
    </section>
  )
}

function Bullets({ title, items, icon }: { title: string; items: string[]; icon: string }) {
  if (!items.length) return null
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((t) => (
          <li key={t} className="flex gap-2 rounded-xl bg-surface-2 p-3 text-sm">
            <span className="font-bold text-accent">{icon}</span>
            {t}
          </li>
        ))}
      </ul>
    </section>
  )
}
