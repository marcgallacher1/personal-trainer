/** Shown as big tiles. 'other' opens the gym list below. */
export const CARDIO_MAIN = ['run', 'walk', 'cycle', 'swim'] as const

/** Behind "Other": gym machines first, then workouts/classes, then a catch-all. */
export const CARDIO_GYM_MACHINES = [
  'stairs',
  'ski_erg',
  'exercise_bike',
  'air_bike',
  'elliptical',
  'row',
] as const
export const CARDIO_GYM_CLASSES = [
  'spin',
  'hiit',
  'sled',
  'battle_ropes',
  'skipping',
  'boxing',
  'hike',
  'other',
] as const

export const CARDIO_ACTIVITIES = [
  ...CARDIO_MAIN,
  ...CARDIO_GYM_MACHINES,
  ...CARDIO_GYM_CLASSES,
] as const
export type CardioActivity = (typeof CARDIO_ACTIVITIES)[number]

export const CARDIO_LABELS: Record<CardioActivity, { name: string; emoji: string }> = {
  run: { name: 'Running', emoji: '🏃' },
  walk: { name: 'Walking', emoji: '🚶' },
  cycle: { name: 'Cycling', emoji: '🚴' },
  swim: { name: 'Swimming', emoji: '🏊' },
  stairs: { name: 'Stair climber', emoji: '🪜' },
  ski_erg: { name: 'Ski erg', emoji: '⛷️' },
  exercise_bike: { name: 'Exercise bike', emoji: '🚲' },
  air_bike: { name: 'Air / assault bike', emoji: '💨' },
  // id kept as 'elliptical' for existing data; UK gyms call it a cross-trainer
  elliptical: { name: 'Cross-trainer', emoji: '🔄' },
  row: { name: 'Rowing machine', emoji: '🚣' },
  spin: { name: 'Spin class', emoji: '🚴' },
  hiit: { name: 'HIIT', emoji: '⚡' },
  sled: { name: 'Sled push / pull', emoji: '🛷' },
  battle_ropes: { name: 'Battle ropes', emoji: '🪢' },
  skipping: { name: 'Skipping', emoji: '🪢' },
  boxing: { name: 'Boxing / bag work', emoji: '🥊' },
  hike: { name: 'Hiking', emoji: '🥾' },
  other: { name: 'Something else', emoji: '❤️' },
}

export const isMainCardio = (a: string): boolean => (CARDIO_MAIN as readonly string[]).includes(a)

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
