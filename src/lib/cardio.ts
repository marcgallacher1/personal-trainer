export const CARDIO_ACTIVITIES = [
  'run',
  'walk',
  'cycle',
  'row',
  'elliptical',
  'stairs',
  'swim',
  'hiit',
  'other',
] as const
export type CardioActivity = (typeof CARDIO_ACTIVITIES)[number]

export const CARDIO_LABELS: Record<CardioActivity, { name: string; emoji: string }> = {
  run: { name: 'Running', emoji: '🏃' },
  walk: { name: 'Walking', emoji: '🚶' },
  cycle: { name: 'Cycling', emoji: '🚴' },
  row: { name: 'Rowing', emoji: '🚣' },
  elliptical: { name: 'Elliptical', emoji: '⭕' },
  stairs: { name: 'Stair climber', emoji: '🪜' },
  swim: { name: 'Swimming', emoji: '🏊' },
  hiit: { name: 'HIIT', emoji: '⚡' },
  other: { name: 'Other', emoji: '❤️' },
}

export interface CardioLike {
  activity: string
  duration_seconds: number
  calories: number | null
  distance_km: number | null
  avg_hr: number | null
}

export function cardioName(activity: string): string {
  return CARDIO_LABELS[activity as CardioActivity]?.name ?? activity
}

export function cardioEmoji(activity: string): string {
  return CARDIO_LABELS[activity as CardioActivity]?.emoji ?? '❤️'
}

/** "20 min · 250 kcal · 3.2 km · 142 bpm" — optional parts omitted. */
export function cardioSummary(e: CardioLike): string {
  const parts = [`${Math.round(e.duration_seconds / 60)} min`]
  if (e.calories) parts.push(`${e.calories} kcal`)
  if (e.distance_km) parts.push(`${Math.round(e.distance_km * 100) / 100} km`)
  if (e.avg_hr) parts.push(`${e.avg_hr} bpm`)
  return parts.join(' · ')
}

/** Totals across entries (deleted ones should be filtered out first). */
export function cardioTotals(entries: readonly CardioLike[]): {
  minutes: number
  calories: number
} {
  return {
    minutes: Math.round(entries.reduce((s, e) => s + e.duration_seconds, 0) / 60),
    calories: entries.reduce((s, e) => s + (e.calories ?? 0), 0),
  }
}
