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
  details_json?: unknown
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
  const extra = detailsSummary(cardioDetails(e.details_json))
  if (extra) parts.push(extra)
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

/** Cardio in a plan workout (plan_sessions.cardio_json). */
export interface PlannedCardio {
  activity: CardioActivity
  minutes: number
  /** Optional plan for speed, incline, intervals… */
  details?: CardioDetails
}

/** Reads cardio_json safely; skips anything malformed. */
export function plannedCardio(json: unknown): PlannedCardio[] {
  if (!Array.isArray(json)) return []
  return json.flatMap((x: unknown) => {
    const { activity, minutes, details } = (x ?? {}) as {
      activity?: unknown
      minutes?: unknown
      details?: unknown
    }
    if (
      typeof activity !== 'string' ||
      !(CARDIO_ACTIVITIES as readonly string[]).includes(activity) ||
      typeof minutes !== 'number' ||
      minutes <= 0
    )
      return []
    const d = cleanDetails(activity, cardioDetails(details))
    const item: PlannedCardio = {
      activity: activity as CardioActivity,
      minutes: Math.round(minutes),
    }
    return [Object.keys(d).length ? { ...item, details: d } : item]
  })
}

/** "20 min run" / "20 min run + 10 min rowing machine" */
export function describePlannedCardio(items: readonly PlannedCardio[]): string {
  return items.map((c) => `${c.minutes} min ${cardioName(c.activity).toLowerCase()}`).join(' + ')
}

/** Planned cardio not logged yet: each logged entry ticks off one of the same activity. */
export function cardioLeft(
  planned: readonly PlannedCardio[],
  logged: readonly { activity: string }[],
): PlannedCardio[] {
  const done = logged.map((l) => l.activity)
  return planned.filter((p) => {
    const i = done.indexOf(p.activity)
    if (i < 0) return true
    done.splice(i, 1)
    return false
  })
}

/** Optional extras on a cardio entry (cardio_entries.details_json). All optional. */
export interface CardioDetails {
  speedKmh?: number
  inclinePct?: number
  /** Machine resistance or level */
  level?: number
  /** Intervals: rounds of work then rest */
  rounds?: number
  workSeconds?: number
  restSeconds?: number
  poolLengthM?: number
  lengths?: number
}

export type DetailField = 'speed' | 'incline' | 'level' | 'intervals' | 'pool'

/** Which extras make sense for an activity. */
export function detailFields(activity: string): DetailField[] {
  switch (activity) {
    case 'run':
    case 'walk':
      return ['speed', 'incline', 'intervals']
    case 'hike':
      return ['incline']
    case 'swim':
      return ['pool', 'intervals']
    case 'cycle':
      return ['speed', 'intervals']
    case 'exercise_bike':
    case 'air_bike':
    case 'spin':
    case 'row':
    case 'ski_erg':
    case 'stairs':
      return ['level', 'intervals']
    case 'elliptical':
      return ['level', 'incline', 'intervals']
    case 'hiit':
    case 'battle_ropes':
    case 'skipping':
    case 'boxing':
    case 'sled':
      return ['intervals']
    default:
      return []
  }
}

const NUM_KEYS = [
  'speedKmh',
  'inclinePct',
  'level',
  'rounds',
  'workSeconds',
  'restSeconds',
  'poolLengthM',
  'lengths',
] as const

/** Reads details_json safely, keeping only positive numbers. */
export function cardioDetails(json: unknown): CardioDetails {
  const out: CardioDetails = {}
  if (!json || typeof json !== 'object' || Array.isArray(json)) return out
  for (const k of NUM_KEYS) {
    const v = (json as Record<string, unknown>)[k]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v
  }
  return out
}

/** Drops empty (0) values and anything that doesn't apply to the activity. */
export function cleanDetails(activity: string, d: CardioDetails): CardioDetails {
  const f = new Set(detailFields(activity))
  const keep: CardioDetails = {
    ...(f.has('speed') && { speedKmh: d.speedKmh }),
    ...(f.has('incline') && { inclinePct: d.inclinePct }),
    ...(f.has('level') && { level: d.level }),
    ...(f.has('intervals') && {
      rounds: d.rounds,
      workSeconds: d.workSeconds,
      restSeconds: d.restSeconds,
    }),
    ...(f.has('pool') && { poolLengthM: d.poolLengthM, lengths: d.lengths }),
  }
  return cardioDetails(keep)
}

/** Swim distance from pool length × lengths, in km. */
export function swimKm(d: CardioDetails): number | null {
  return d.poolLengthM && d.lengths ? Math.round(d.poolLengthM * d.lengths) / 1000 : null
}

const secs = (s: number) => (s % 60 === 0 ? `${s / 60} min` : `${s}s`)

/** "8.5 km/h · 5% incline · 6 × 1 min on, 90s off" / "40 × 25 m" */
export function detailsSummary(d: CardioDetails): string {
  const parts: string[] = []
  if (d.lengths)
    parts.push(d.poolLengthM ? `${d.lengths} × ${d.poolLengthM} m` : `${d.lengths} lengths`)
  if (d.speedKmh) parts.push(`${d.speedKmh} km/h`)
  if (d.inclinePct) parts.push(`${d.inclinePct}% incline`)
  if (d.level) parts.push(`level ${d.level}`)
  if (d.rounds) {
    const on = d.workSeconds ? ` × ${secs(d.workSeconds)} on` : ' rounds'
    const off = d.restSeconds ? `, ${secs(d.restSeconds)} off` : ''
    parts.push(`${d.rounds}${on}${off}`)
  }
  return parts.join(' · ')
}
