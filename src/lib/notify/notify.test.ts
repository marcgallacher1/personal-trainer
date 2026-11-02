import { describe, expect, it } from 'vitest'
import {
  dueNotifications,
  inQuietHours,
  londonParts,
  reschedule,
  weeklyStreak,
  type NotifyState,
} from './evaluate'
import { hash, pickMessage } from './messages'
import { ruleFromRow, ruleToRow, type RuleRow } from './rules'

// The defaults seeded by the notifications migration (the user's answers)
const row = (r: Partial<RuleRow> & { type: string }): RuleRow => ({
  enabled: true,
  times_json: {},
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  conditions_json: {},
  followups_json: {},
  tone: 'mix',
  custom_messages: [],
  paused_until: null,
  ...r,
})
const RULES = [
  row({
    type: 'gym',
    times_json: { times: ['15:00', '17:30'], byWeekday: { '6': ['10:00'], '7': ['13:00'] } },
    conditions_json: { days: 'plan', skipIfLogged: true },
    followups_json: { times: ['19:30'] },
  }),
  row({ type: 'log_session', times_json: { afterStartMinutes: 120 } }),
  row({
    type: 'missed_workout',
    times_json: { times: ['20:00'] },
    conditions_json: { days: 'plan', suggestReschedule: true },
  }),
  row({
    type: 'weekly_rundown',
    times_json: { times: ['19:00'] },
    weekdays: [7],
    conditions_json: { days: 'custom' },
  }),
  row({
    type: 'protein',
    times_json: { times: ['14:00', '20:00'] },
    conditions_json: { days: 'all', showRemaining: true },
  }),
  row({
    type: 'bodyweight',
    times_json: { times: ['07:30'] },
    weekdays: [1],
    conditions_json: { days: 'custom', skipIfLogged: true },
    followups_json: { times: ['21:00'] },
  }),
  row({
    type: 'celebration',
    times_json: { times: ['09:00'] },
    conditions_json: { pbs: true, streaks: true, countdown: true },
  }),
  row({ type: 'plan_proposal', enabled: false }),
].map(ruleFromRow)

/** Mon + Tue plan, like the user's */
const PLAN = { days: { 1: ['Push A'], 2: ['Pull A'] } }

function state(now: string, over: Partial<NotifyState> = {}): NotifyState {
  return {
    now,
    rules: RULES,
    quiet: { start: '22:00', end: '07:00' },
    pausedUntil: null,
    goal: null,
    plan: PLAN,
    workoutToday: false,
    openWorkout: null,
    bodyweightToday: false,
    protein: { eaten: 0, target: null },
    pbWorkouts: [],
    streakWeeks: 0,
    rundown: null,
    sent: new Set(),
    ...over,
  }
}
const keys = (s: NotifyState) =>
  dueNotifications(s).map((d) => `${d.key}${d.status === 'skip' ? ` (skip: ${d.reason})` : ''}`)

// 2026-11-02 is a Monday; GMT (London = UTC)
const MON = '2026-11-02'

describe('London time', () => {
  it('reads the London date, weekday and time, including summer time', () => {
    expect(londonParts('2026-11-02T15:00:00Z')).toEqual({ date: MON, weekday: 1, minutes: 900 })
    expect(londonParts('2026-07-05T23:30:00Z')).toEqual({
      date: '2026-07-06',
      weekday: 1,
      minutes: 30,
    })
  })

  it('knows quiet hours that run past midnight', () => {
    const q = { start: '22:00', end: '07:00' }
    expect(
      [21 * 60 + 59, 22 * 60, 3 * 60, 6 * 60 + 59, 7 * 60].map((m) => inQuietHours(m, q)),
    ).toEqual([false, true, true, true, false])
    expect(inQuietHours(600, null)).toBe(false)
  })
})

describe('go to the gym', () => {
  it('fires at 15:00 and 17:30 on a plan day, within the lookback window only', () => {
    expect(keys(state(`${MON}T14:59:00Z`))).toEqual([])
    expect(keys(state(`${MON}T15:00:00Z`))).toEqual([`gym:${MON}:15:00`])
    expect(keys(state(`${MON}T15:29:00Z`))).toEqual([`gym:${MON}:15:00`])
    expect(keys(state(`${MON}T15:31:00Z`))).toEqual([])
    expect(keys(state(`${MON}T17:30:00Z`))).toEqual([`gym:${MON}:17:30`])
  })

  it('never sends the same one twice', () => {
    expect(keys(state(`${MON}T15:05:00Z`, { sent: new Set([`gym:${MON}:15:00`]) }))).toEqual([])
  })

  it('names the planned workout', () => {
    const [d] = dueNotifications(state(`${MON}T15:00:00Z`))
    expect(d!.title).toBe('Push A today 🏋️')
    expect(d!.body).toContain('Push A')
  })

  it('stays quiet on rest days, but covers every day with no plan (Sat 10:00, Sun 13:00)', () => {
    expect(keys(state('2026-11-04T15:00:00Z'))).toEqual([]) // Wednesday, rest
    expect(keys(state('2026-11-04T15:00:00Z', { plan: null }))).toEqual(['gym:2026-11-04:15:00'])
    expect(keys(state('2026-11-07T10:00:00Z', { plan: null }))).toEqual(['gym:2026-11-07:10:00'])
    expect(keys(state('2026-11-07T15:00:00Z', { plan: null }))).toEqual([])
    expect(keys(state('2026-11-08T13:00:00Z', { plan: null }))).toEqual(['gym:2026-11-08:13:00'])
  })

  it('is skipped if you’ve already started a workout, and so is the 19:30 follow-up', () => {
    expect(keys(state(`${MON}T15:00:00Z`, { workoutToday: true }))).toEqual([
      `gym:${MON}:15:00 (skip: already logged)`,
    ])
    expect(keys(state(`${MON}T19:30:00Z`))).toEqual([`gym:${MON}:f19:30`])
    expect(keys(state(`${MON}T19:30:00Z`, { workoutToday: true }))).toEqual([
      `gym:${MON}:f19:30 (skip: already logged)`,
    ])
  })

  it('uses London time across the clock changes', () => {
    // 29 Mar 2026: clocks go forward, 15:00 London = 14:00 UTC (a Sunday: 13:00)
    expect(keys(state('2026-03-29T12:00:00Z', { plan: null }))).toEqual(['gym:2026-03-29:13:00'])
    expect(keys(state('2026-03-30T14:00:00Z', { plan: null }))).toEqual(['gym:2026-03-30:15:00'])
    // 25 Oct 2026: clocks go back, 13:00 London = 13:00 UTC
    expect(keys(state('2026-10-25T12:00:00Z', { plan: null }))).toEqual([])
    expect(keys(state('2026-10-25T13:00:00Z', { plan: null }))).toEqual(['gym:2026-10-25:13:00'])
  })

  it('logs but doesn’t send while paused', () => {
    expect(keys(state(`${MON}T15:00:00Z`, { pausedUntil: '2026-11-05T00:00:00Z' }))).toEqual([
      `gym:${MON}:15:00 (skip: paused)`,
    ])
  })
})

describe('other reminders', () => {
  it('nudges you to save a workout 2 hours after starting it', () => {
    const openWorkout = { id: 'w1', name: 'Push A', startedAt: `${MON}T16:00:00Z` }
    expect(
      keys(state(`${MON}T17:59:00Z`, { openWorkout, workoutToday: true })).filter((k) =>
        k.startsWith('log'),
      ),
    ).toEqual([])
    const [d] = dueNotifications(state(`${MON}T18:00:00Z`, { openWorkout, workoutToday: true }))
    expect(d).toMatchObject({ key: 'log:w1', url: '/log/session/w1', status: 'send' })
  })

  it('flags a missed plan workout at 20:00 and suggests another day', () => {
    // Tue: Pull A not started; Wed is free
    const [d] = dueNotifications(state('2026-11-03T20:00:00Z'))
    expect(d).toMatchObject({ key: 'missed:2026-11-03', title: 'Pull A not started 📅' })
    expect(d!.body).toContain('Tomorrow morning’s free')
    expect(
      keys(state('2026-11-03T20:00:00Z', { workoutToday: true })).filter((k) =>
        k.startsWith('missed'),
      ),
    ).toEqual(['missed:2026-11-03 (skip: already logged)'])
    expect(keys(state('2026-11-04T20:00:00Z')).filter((k) => k.startsWith('missed'))).toEqual([]) // nothing planned Wed
  })

  it('suggests the next free day when tomorrow is taken', () => {
    expect(reschedule(PLAN, 1)).toBe('Wed is free — move it there?')
    expect(
      reschedule(
        { days: { 1: ['A'], 2: ['B'], 3: ['C'], 4: ['D'], 5: ['E'], 6: ['F'], 7: ['G'] } },
        1,
      ),
    ).toMatch(/Fold the key lifts/)
  })

  it('checks protein at 14:00 and 20:00 every day, with grams left when known', () => {
    const wed = '2026-11-04'
    expect(keys(state(`${wed}T14:00:00Z`))).toEqual([`protein:${wed}:14:00`])
    const [d] = dueNotifications(
      state(`${wed}T20:00:00Z`, { protein: { eaten: 110, target: 160 } }),
    )
    expect(d!.body).toContain('50 g to go (110 of 160 g).')
  })

  it('asks for a weigh-in on Monday at 07:30, again at 21:00 if not done', () => {
    expect(keys(state(`${MON}T07:30:00Z`))).toEqual([`bodyweight:${MON}:07:30`])
    expect(keys(state(`${MON}T21:00:00Z`))).toEqual([`bodyweight:${MON}:f21:00`])
    expect(keys(state(`${MON}T21:00:00Z`, { bodyweightToday: true }))).toEqual([
      `bodyweight:${MON}:f21:00 (skip: already logged)`,
    ])
    expect(keys(state('2026-11-03T07:30:00Z'))).toEqual([])
  })

  it('respects quiet hours', () => {
    expect(keys(state(`${MON}T21:00:00Z`, { quiet: { start: '20:30', end: '07:00' } }))).toEqual([
      `bodyweight:${MON}:f21:00 (skip: quiet hours)`,
    ])
  })
})

describe('celebrations', () => {
  it('sends PBs straight after a workout, but holds them in quiet hours', () => {
    const pbWorkouts = [{ id: 'w1', name: 'Push A', pbs: ['Bench e1RM 102 kg', 'Dips: 15 reps'] }]
    const [d] = dueNotifications(state(`${MON}T18:40:00Z`, { pbWorkouts }))
    expect(d).toMatchObject({
      key: 'pb:w1',
      title: '2 new PBs 🏆',
      body: 'Bench e1RM 102 kg · Dips: 15 reps',
    })
    expect(keys(state(`${MON}T22:30:00Z`, { pbWorkouts }))).toEqual([])
  })

  it('marks streak milestones on Monday morning', () => {
    expect(keys(state(`${MON}T09:00:00Z`, { streakWeeks: 8 }))).toEqual([`streak:${MON}:8`])
    expect(keys(state(`${MON}T09:00:00Z`, { streakWeeks: 7 }))).toEqual([])
  })

  it('counts down to the goal date on milestone days', () => {
    const goal = { name: 'Australia', date: '2026-12-28' }
    // 2 Nov → 28 Dec is 56 days: not a milestone; 28 Nov is 30 days out
    expect(
      keys(state(`${MON}T09:00:00Z`, { goal })).filter((k) => k.startsWith('countdown')),
    ).toEqual([])
    const [d] = dueNotifications(state('2026-11-28T09:00:00Z', { goal }))
    expect(d).toMatchObject({ key: 'countdown:2026-12-28:30', title: '30 days to Australia ✈️' })
    expect(dueNotifications(state('2026-12-28T09:00:00Z', { goal }))[0]!.title).toBe(
      'Australia day! ✈️',
    )
  })
})

const copy = (key: string, goal: { name: string; days: number } | null = null) =>
  pickMessage({ pool: 'gym', tone: 'mix', key, vars: { workout: 'Push A' }, goal })

describe('messages', () => {
  it('is stable for the same notification and varied across them', () => {
    expect(copy('gym:2026-11-02:15:00')).toBe(copy('gym:2026-11-02:15:00'))
    const lines = new Set(Array.from({ length: 40 }, (_, i) => copy(`gym:2026-11-${i}:15:00`)))
    expect(lines.size).toBeGreaterThan(6)
  })

  it('works the goal countdown into a good share of reminders', () => {
    const goal = { name: 'Australia', days: 56 }
    const all = Array.from({ length: 200 }, (_, i) => copy(`gym:k${i}`, goal))
    const withGoal = all.filter((m) => m.includes('56 days') || m.includes('Australia'))
    expect(withGoal.length).toBeGreaterThan(60)
    expect(withGoal.length).toBeLessThan(140)
  })

  it('mixes motivational and drill-sergeant lines, never chill', () => {
    const all = new Set(Array.from({ length: 200 }, (_, i) => copy(`gym:t${i}`)))
    expect(
      [...all].some((m) => m.includes('No excuses') || m.includes('Go.') || m.includes('Now.')),
    ).toBe(true)
    expect([...all].some((m) => m.includes('💪') || m.includes('count'))).toBe(true)
    expect([...all].some((m) => m.includes('👋'))).toBe(false)
  })

  it('adds your own messages to the mix', () => {
    const lines = new Set(
      Array.from({ length: 100 }, (_, i) =>
        pickMessage({
          pool: 'gym',
          tone: 'drill',
          key: `k${i}`,
          vars: { workout: 'X' },
          custom: ['Beach body loading'],
        }),
      ),
    )
    expect(lines.has('Beach body loading')).toBe(true)
  })

  it('hashes deterministically', () => {
    expect(hash('abc')).toBe(hash('abc'))
    expect(hash('abc')).not.toBe(hash('abd'))
  })
})

describe('streaks', () => {
  it('counts weeks in a row (ending last week) that hit the target', () => {
    const days = [
      '2026-10-12',
      '2026-10-13',
      '2026-10-19',
      '2026-10-20',
      '2026-10-26',
      '2026-10-27',
      MON,
    ]
    expect(weeklyStreak(days, 2, '2026-11-04')).toBe(3)
    expect(weeklyStreak(days, 3, '2026-11-04')).toBe(0)
    expect(
      weeklyStreak(
        days.filter((d) => d !== '2026-10-19'),
        2,
        '2026-11-04',
      ),
    ).toBe(1)
  })
})

describe('rules', () => {
  it('reads the seeded defaults', () => {
    const gym = RULES.find((r) => r.type === 'gym')!
    expect(gym).toMatchObject({
      times: ['15:00', '17:30'],
      byWeekday: { 6: ['10:00'], 7: ['13:00'] },
      days: 'plan',
      skipIfLogged: true,
      followUps: ['19:30'],
      tone: 'mix',
    })
  })

  it('round-trips through the database shape', () => {
    for (const r of RULES) {
      expect(ruleFromRow({ type: r.type, ...ruleToRow(r) })).toEqual(r)
    }
  })

  it('ignores malformed values', () => {
    const r = ruleFromRow(
      row({ type: 'gym', times_json: { times: ['25:00', '7:30', 9] }, tone: 'shouty' }),
    )
    expect(r.times).toEqual(['7:30'])
    expect(r.tone).toBe('mix')
  })
})
