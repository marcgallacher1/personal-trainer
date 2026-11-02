/** Notification rules as the app and server use them, read from/written to `notification_rules`. */

export const NOTIFY_TYPES = [
  'gym',
  'log_session',
  'missed_workout',
  'protein',
  'bodyweight',
  'celebration',
  'weekly_rundown',
  'plan_proposal',
] as const
export type NotifyType = (typeof NOTIFY_TYPES)[number]

export type Tone = 'chill' | 'motivational' | 'drill' | 'mix'
/** plan = the active plan's training days (every day with no plan), custom = `weekdays` */
export type DaysMode = 'plan' | 'all' | 'custom'

export interface Rule {
  type: NotifyType
  enabled: boolean
  /** HH:MM, London time */
  times: string[]
  /** Per-weekday times that replace `times` (1 = Monday) */
  byWeekday: Partial<Record<number, string[]>>
  days: DaysMode
  weekdays: number[]
  /** Don't send if it's already been done today */
  skipIfLogged: boolean
  /** Extra reminders (HH:MM) if still not done */
  followUps: string[]
  /** log_session: minutes after starting a workout */
  afterStartMinutes: number
  /** missed_workout: suggest another day */
  suggestReschedule: boolean
  /** protein: include grams left */
  showRemaining: boolean
  /** celebration: which ones */
  celebrate: { pbs: boolean; streaks: boolean; countdown: boolean }
  tone: Tone
  customMessages: string[]
  pausedUntil: string | null
}

export interface RuleRow {
  type: string
  enabled: boolean
  times_json: unknown
  weekdays: number[]
  conditions_json: unknown
  followups_json: unknown
  tone: string
  custom_messages: string[]
  paused_until: string | null
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && isTime(x)) : []
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

/** "07:30" or "7:30" */
export const isTime = (t: string): boolean => /^([01]?\d|2[0-3]):[0-5]\d$/.test(t)
export const toMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h! * 60 + m!
}

/** Reads a DB row, filling anything missing or malformed with safe values. */
export function ruleFromRow(row: RuleRow): Rule {
  const times = obj(row.times_json)
  const cond = obj(row.conditions_json)
  const follow = obj(row.followups_json)
  const byWeekday: Rule['byWeekday'] = {}
  for (const [k, v] of Object.entries(obj(times.byWeekday))) {
    const d = Number(k)
    if (d >= 1 && d <= 7) byWeekday[d] = strings(v)
  }
  const days = cond.days === 'plan' || cond.days === 'custom' ? cond.days : 'all'
  return {
    type: (NOTIFY_TYPES as readonly string[]).includes(row.type) ? (row.type as NotifyType) : 'gym',
    enabled: row.enabled,
    times: strings(times.times),
    byWeekday,
    days,
    weekdays: row.weekdays.filter((d) => d >= 1 && d <= 7),
    skipIfLogged: bool(cond.skipIfLogged, false),
    followUps: strings(follow.times),
    afterStartMinutes: typeof times.afterStartMinutes === 'number' ? times.afterStartMinutes : 120,
    suggestReschedule: bool(cond.suggestReschedule, true),
    showRemaining: bool(cond.showRemaining, true),
    celebrate: {
      pbs: bool(cond.pbs, true),
      streaks: bool(cond.streaks, true),
      countdown: bool(cond.countdown, true),
    },
    tone: ['chill', 'motivational', 'drill', 'mix'].includes(row.tone) ? (row.tone as Tone) : 'mix',
    customMessages: row.custom_messages.filter((m) => m.trim() !== ''),
    pausedUntil: row.paused_until,
  }
}

/** The DB columns for a rule. */
export function ruleToRow(r: Rule): Omit<RuleRow, 'type'> & { timing_mode: string } {
  return {
    enabled: r.enabled,
    timing_mode:
      r.type === 'log_session'
        ? 'relative_to_session'
        : Object.keys(r.byWeekday).length
          ? 'per_weekday'
          : 'fixed',
    times_json:
      r.type === 'log_session'
        ? { afterStartMinutes: r.afterStartMinutes }
        : {
            times: r.times,
            ...(Object.keys(r.byWeekday).length ? { byWeekday: r.byWeekday } : {}),
          },
    weekdays: r.weekdays,
    conditions_json: {
      days: r.days,
      skipIfLogged: r.skipIfLogged,
      suggestReschedule: r.suggestReschedule,
      showRemaining: r.showRemaining,
      ...(r.type === 'celebration' ? r.celebrate : {}),
    },
    followups_json: r.followUps.length ? { times: r.followUps } : {},
    tone: r.tone,
    custom_messages: r.customMessages,
    paused_until: r.pausedUntil,
  }
}

/** Times a rule fires on a weekday (1 = Monday). */
export function timesOn(r: Rule, weekday: number): string[] {
  return r.byWeekday[weekday] ?? r.times
}
