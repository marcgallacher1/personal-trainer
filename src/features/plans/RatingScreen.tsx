import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { showToast } from '../../components/Toast'
import { planVsActual, type Fix, type Point, type Rating } from '../../lib/rating/rate'
import { BodyMap } from './BodyMap'
import { usePlanRows } from './data'
import { applyFix, rateSavedPlan, useActualRating, useRatingContext } from './rating'
import { ScoreRing } from './ScoreBadge'

const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))

/** "Rate my plan": score, what's working, what could be better (with one-tap fixes), heatmap. */
export function RatingScreen() {
  const { planId } = useParams()
  const rows = usePlanRows(planId)
  const ctx = useRatingContext()
  const actual = useActualRating(ctx)
  const [tab, setTab] = useState<'plan' | 'actual'>('plan')

  if (rows === undefined || !ctx) return null
  if (!rows || rows.plan.deleted_at) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted">This plan doesn’t exist any more.</p>
        <Link to="/plans" className="mt-4 inline-block font-semibold text-accent">
          Back to plans
        </Link>
      </div>
    )
  }
  const rating = rateSavedPlan(rows, ctx)

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallback={`/plans/${rows.plan.id}`} label={rows.plan.name} />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Plan rating</h1>
        <p className="text-sm text-muted">{rows.plan.name}</p>
      </div>

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
        {(
          [
            ['plan', 'Your plan'],
            ['actual', 'What you actually did'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`h-10 rounded-lg text-sm font-semibold ${
              tab === id ? 'bg-surface text-text shadow' : 'text-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'plan' ? (
        rating.score === 0 ? (
          <Empty>Add some workouts with exercises to this plan to get a rating.</Empty>
        ) : (
          <RatingView
            rating={rating}
            basis={`Based on ${fmt(rating.workoutsPerWeek)} workout${rating.workoutsPerWeek === 1 ? '' : 's'} a week.`}
            onFix={async (fix) => {
              await applyFix(rows.plan.id, fix)
              showToast({ message: 'Plan updated' })
            }}
          />
        )
      ) : actual === undefined ? null : actual === null ? (
        <Empty>
          Nothing logged in the last 4 weeks yet. Log a few workouts and this will show how your
          real training compares with the plan.
        </Empty>
      ) : (
        <RatingView
          rating={actual.rating}
          basis={`Based on ${actual.sessions} workout${actual.sessions === 1 ? '' : 's'} over the last ${
            actual.weeks >= 3.5 ? '4 weeks' : `${fmt(Math.round(actual.weeks * 2) / 2)} weeks`
          } (about ${fmt(actual.rating.workoutsPerWeek)} a week).`}
          gaps={rating.score ? planVsActual(rating, actual.rating) : []}
        />
      )}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-surface p-6 text-center text-muted">{children}</p>
}

function RatingView({
  rating,
  basis,
  onFix,
  gaps = [],
}: {
  rating: Rating
  basis: string
  onFix?: (fix: Fix) => Promise<void>
  gaps?: ReturnType<typeof planVsActual>
}) {
  return (
    <>
      <section className="flex items-center gap-4 rounded-3xl bg-surface p-4">
        <ScoreRing score={rating.score} />
        <div className="min-w-0">
          <p className="text-2xl font-bold">{rating.verdict}</p>
          <p className="text-sm text-muted">{basis}</p>
        </div>
      </section>

      {rating.strengths.length > 0 && (
        <Section title="What’s working">
          <ul className="flex flex-col gap-2">
            {rating.strengths.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="font-bold text-success">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {gaps.length > 0 && (
        <Section title="Plan vs what you did" hint="Weekly sets">
          <ul className="flex flex-col divide-y divide-border">
            {gaps.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                <span className="font-semibold">{g.name}</span>
                <span className="text-sm text-muted">
                  planned {fmt(g.planned)} · did {fmt(g.actual)}{' '}
                  <span className={g.actual < g.planned ? 'text-warn' : 'text-accent'}>
                    {g.actual < g.planned ? '▼' : '▲'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {rating.lacking.length > 0 && (
        <Section title="Could be even better">
          <Points points={rating.lacking} onFix={onFix} />
        </Section>
      )}

      {rating.overdone.length > 0 && (
        <Section title="Maybe a bit much">
          <Points points={rating.overdone} onFix={onFix} />
        </Section>
      )}

      <Section title="Weekly sets per muscle">
        <BodyMap muscles={rating.muscles} />
      </Section>

      <Section title="Score breakdown">
        <ul className="flex flex-col gap-3">
          {rating.subscores.map((s) => (
            <li key={s.id}>
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{s.label}</span>
                <span className="text-sm font-bold tabular-nums">{s.score}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${s.score >= 80 ? 'bg-success' : s.score >= 60 ? 'bg-accent' : 'bg-warn'}`}
                  style={{ width: `${s.score}%` }}
                />
              </div>
              <p className="mt-1 text-sm text-muted">{s.summary}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl bg-surface p-4">
      <h2 className="mb-3 flex items-baseline justify-between text-xs font-semibold tracking-wide text-muted uppercase">
        {title}
        {hint && <span className="font-normal normal-case">{hint}</span>}
      </h2>
      {children}
    </section>
  )
}

function Points({ points, onFix }: { points: Point[]; onFix?: (fix: Fix) => Promise<void> }) {
  return (
    <ul className="flex flex-col gap-3">
      {points.map((p) => (
        <li key={p.text} className="flex flex-col gap-2">
          <p>{p.text}</p>
          {p.fix && onFix && <FixRow fix={p.fix} onFix={onFix} />}
          {p.alternative && onFix && (
            <>
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                Or, if you can train another day
              </p>
              <FixRow fix={p.alternative} onFix={onFix} />
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

function FixRow({ fix, onFix }: { fix: Fix; onFix: (fix: Fix) => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
      <span className="min-w-0 flex-1 text-sm">{fix.text}</span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onFix(fix)
          } finally {
            setBusy(false)
          }
        }}
        className="h-10 shrink-0 rounded-lg bg-accent px-4 text-sm font-bold text-accent-fg disabled:opacity-50"
      >
        {busy ? '…' : 'Apply'}
      </button>
    </div>
  )
}
