import { useLiveQuery } from 'dexie-react-hooks'
import type { Tables } from '../../db/database.types'
import { db } from '../../db/local'
import { saveOne } from '../../db/write'
import {
  NOTIFY_TYPES,
  ruleFromRow,
  ruleToRow,
  type NotifyType,
  type Rule,
} from '../../lib/notify/rules'

export type RuleRow = Tables<'notification_rules'>

export interface RuleEntry {
  row: RuleRow
  rule: Rule
}

/** The user's notification rules, in a fixed order. */
export function useRules(): RuleEntry[] | undefined {
  return useLiveQuery(async () => {
    const rows = (await db.notification_rules.toArray()).filter((r) => !r.deleted_at)
    return rows
      .map((row) => ({ row, rule: ruleFromRow(row) }))
      .toSorted((a, b) => NOTIFY_TYPES.indexOf(a.rule.type) - NOTIFY_TYPES.indexOf(b.rule.type))
  }, [])
}

export async function saveRule(entry: RuleEntry, rule: Rule): Promise<void> {
  await saveOne('notification_rules', { ...entry.row, ...ruleToRow(rule) })
}

export const RULE_INFO: Record<NotifyType, { name: string; emoji: string; question: string }> = {
  gym: {
    name: 'Go to the gym',
    emoji: '🏋️',
    question: 'When should I remind you to train?',
  },
  log_session: {
    name: 'Save your workout',
    emoji: '📝',
    question: 'If you start a workout but don’t save it, when should I nudge you?',
  },
  missed_workout: {
    name: 'Missed workout',
    emoji: '📅',
    question: 'If you haven’t started a planned workout, when should I check in?',
  },
  protein: {
    name: 'Protein check-ins',
    emoji: '🥩',
    question: 'When should I check on your protein?',
  },
  bodyweight: {
    name: 'Weigh-in',
    emoji: '⚖️',
    question: 'When should I remind you to weigh in?',
  },
  celebration: {
    name: 'PBs and milestones',
    emoji: '🏆',
    question: 'What should I celebrate?',
  },
  weekly_rundown: {
    name: 'Weekly rundown',
    emoji: '📊',
    question: 'When should your weekly report arrive?',
  },
  plan_proposal: {
    name: 'Plan suggestions',
    emoji: '💡',
    question: 'Should suggested plan changes send a notification? (They always show in the app.)',
  },
}

export const TONES = [
  { id: 'chill', name: 'Chill', example: 'Gym later? Push A is waiting.' },
  {
    id: 'motivational',
    name: 'Motivational',
    example: 'Push A today. Let’s make it a good one 💪',
  },
  { id: 'drill', name: 'Drill sergeant', example: 'Push A. Today. No excuses.' },
  { id: 'mix', name: 'Motivational + drill', example: 'A mix of both, so it never gets stale.' },
] as const

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** One-line summary, e.g. "15:00, 17:30 on plan days · Sat 10:00 · follow-up 19:30". */
export function summarise(r: Rule): string {
  if (!r.enabled) return 'Off'
  switch (r.type) {
    case 'log_session':
      return `${Math.round(r.afterStartMinutes / 6) / 10} h after starting, if not saved`
    case 'plan_proposal':
      return 'Push on'
    case 'celebration':
      return (
        [
          r.celebrate.pbs && 'PBs',
          r.celebrate.streaks && 'streaks',
          r.celebrate.countdown && 'countdown',
        ]
          .filter(Boolean)
          .join(', ') || 'Nothing selected'
      )
  }
  const days =
    r.days === 'plan'
      ? 'on plan days'
      : r.days === 'all' || r.weekdays.length === 7
        ? 'every day'
        : `on ${r.weekdays.map((d) => DAY[d - 1]).join(', ')}`
  const parts = [`${r.times.join(', ') || 'no time set'} ${days}`]
  for (const [d, times] of Object.entries(r.byWeekday)) {
    if (times?.length) parts.push(`${DAY[Number(d) - 1]} ${times.join(', ')}`)
  }
  if (r.followUps.length) parts.push(`follow-up ${r.followUps.join(', ')}`)
  return parts.join(' · ')
}
