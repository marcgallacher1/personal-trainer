/** A plan's rating out of 100, coloured from "room to grow" to "excellent". */
export function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 80
      ? 'bg-success text-bg'
      : score >= 60
        ? 'bg-accent text-accent-fg'
        : 'bg-surface-2 text-text ring-1 ring-border'
  return (
    <span
      aria-label={`Rated ${score} out of 100`}
      className={`inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full px-1.5 text-sm font-bold tabular-nums ${tone}`}
    >
      {score}
    </span>
  )
}

/** The big score on the rating screen: a ring filled to the score. */
export function ScoreRing({ score }: { score: number }) {
  const r = 42
  const c = 2 * Math.PI * r
  const colour =
    score >= 80 ? 'var(--color-success)' : score >= 60 ? 'var(--color-accent)' : 'var(--color-warn)'
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-28 w-28 shrink-0"
      role="img"
      aria-label={`${score} out of 100`}
    >
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="9" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={colour}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${(c * score) / 100} ${c}`}
        transform="rotate(-90 50 50)"
      />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--color-text)"
        fontSize="30"
        fontWeight="700"
      >
        {score}
      </text>
    </svg>
  )
}
