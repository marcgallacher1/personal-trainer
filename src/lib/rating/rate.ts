/** Rates a plan, or logged training, out of 100 with reasons and fixes. */
import { isTimed, type LogType } from '../logging/types'
import type { TargetLike } from '../plans/targets'
import {
  BACK_TO_BACK_CREDIT,
  DEFAULT_RANGES,
  FAMILY,
  GENERIC_RANGE,
  PATTERNS,
  PER_SESSION_MAX,
  PULL_MUSCLES,
  PUSH_MUSCLES,
  SUGGEST_FOR_MUSCLE,
  type PatternRule,
} from './rules'

export interface RatingExercise {
  id: string
  name: string
  pattern: string
  isCompound: boolean
  logType: LogType
  restSeconds: number
  /** Primary movers 1, secondary 0.5 */
  muscles: readonly { muscleId: string; weight: number }[]
}

export interface RatingWorkout {
  id: string
  name: string
  /** How many times a week this workout happens (a logged session over 4 weeks = 0.25) */
  timesPerWeek: number
  /** Plan: ISO weekdays (1–7, repeating weekly). Actual: day numbers (days since epoch). */
  days: readonly number[]
  exercises: readonly {
    id: string
    exerciseId: string
    sets: readonly TargetLike[]
    /** Superset group; grouped exercises are moved together by a regroup fix */
    groupId?: string | null
  }[]
}

export interface MuscleGoal {
  id: string
  name: string
  /** The stored target; the generic 10–20 is swapped for a muscle-specific default */
  min: number
  max: number
  priority: boolean
  paused: boolean
}

export type Focus = 'hypertrophy' | 'strength' | 'general' | 'fat_loss'

export interface RatingInput {
  mode: 'plan' | 'actual'
  workouts: readonly RatingWorkout[]
  exercises: ReadonlyMap<string, RatingExercise>
  muscles: readonly MuscleGoal[]
  focus: Focus | null
  /** Actual mode: how many weeks the logged workouts span */
  weeks?: number
}

export type MuscleStatus = 'paused' | 'low' | 'ok' | 'high'

export interface MuscleVolume {
  id: string
  name: string
  /** Weekly working sets (secondary movers count half), rounded to 0.5 */
  sets: number
  /** Times a week it gets a meaningful amount of work */
  frequency: number
  min: number
  max: number
  priority: boolean
  paused: boolean
  status: MuscleStatus
}

export type SubScoreId = 'volume' | 'balance' | 'frequency' | 'coverage' | 'recovery' | 'goal'

export interface SubScore {
  id: SubScoreId
  label: string
  score: number
  summary: string
}

export type Fix =
  | {
      kind: 'add'
      id: string
      text: string
      workoutId: string
      exerciseId: string
      sets: number
    }
  | {
      /** Change how many working sets a planned exercise has */
      kind: 'sets'
      id: string
      text: string
      workoutId: string
      planExerciseId: string
      sets: number
    }
  | {
      /** Move a workout from one weekday to another */
      kind: 'move'
      id: string
      text: string
      workoutId: string
      fromDay: number
      toDay: number
    }
  | {
      /** Re-split two workouts' exercises by muscle group (e.g. push day + pull day) */
      kind: 'regroup'
      id: string
      text: string
      moves: { planExerciseId: string; toWorkoutId: string }[]
    }

export interface Point {
  text: string
  muscleId?: string
  fix?: Fix
  /** A different way to solve the same problem (apply one or the other) */
  alternative?: Fix
}

export interface Rating {
  score: number
  verdict: string
  subscores: SubScore[]
  muscles: MuscleVolume[]
  strengths: string[]
  lacking: Point[]
  overdone: Point[]
  workoutsPerWeek: number
}

/** See rules.ts for the evidence behind these weights and thresholds. */
const WEIGHTS: Record<SubScoreId, number> = {
  volume: 25,
  balance: 15,
  frequency: 15,
  coverage: 10,
  recovery: 20,
  goal: 15,
}

/** Sets in one workout that count as "training" a muscle that day. */
const HIT = 1.5
/** Sets in one day that make a muscle need a rest day after. */
const HEAVY = 4
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
/** Days apart on a weekly cycle (Sun → Mon is 1). */
const dist = (x: number, y: number) => Math.min(Math.abs(x - y), 7 - Math.abs(x - y))
const LONG_SESSION_MIN = 90
/** A little over the top of the range isn't worth flagging */
const LEEWAY = 1.1
/** Most working sets worth doing of one exercise in one workout */
const MAX_SETS_PER_EXERCISE = 5

const round1 = (n: number) => Math.round(n * 2) / 2
const pct = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 100)
const working = (sets: readonly TargetLike[]) => sets.filter((s) => s.set_type !== 'warmup')
const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1)
const weightedMean = (items: { w: number; v: number }[]) => {
  const total = items.reduce((a, b) => a + b.w, 0)
  return total ? items.reduce((a, b) => a + b.w * b.v, 0) / total : 1
}
const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))

export function rangeFor(m: Pick<MuscleGoal, 'id' | 'min' | 'max' | 'priority'>): {
  min: number
  max: number
} {
  const generic = m.min === GENERIC_RANGE[0] && m.max === GENERIC_RANGE[1]
  const [min, max] = generic ? (DEFAULT_RANGES[m.id] ?? GENERIC_RANGE) : [m.min, m.max]
  // Priority muscles aim for the upper part of their range
  return m.priority ? { min: Math.round(min + (max - min) * 0.4), max } : { min, max }
}

/** Two workouts on consecutive days that both hit the same muscles hard. */
interface Clash {
  first: RatingWorkout
  second: RatingWorkout
  /** Day of the first workout, and the day after */
  day: number
  nextDay: number
  muscles: string[]
}

export function verdictFor(score: number): string {
  if (score >= 85) return 'Excellent plan'
  if (score >= 70) return 'Solid plan'
  if (score >= 55) return 'Good start'
  return 'Plenty to build on'
}

export function ratePlan(input: RatingInput): Rating {
  const { workouts, exercises } = input
  const active = input.muscles.filter((m) => !m.paused)
  const activeIds = new Set(active.map((m) => m.id))
  const weeks = input.mode === 'actual' ? Math.max(1, input.weeks ?? 1) : 1

  // Per workout: weighted sets per muscle
  const perWorkout = new Map<string, Map<string, number>>()
  for (const w of workouts) {
    const m = new Map<string, number>()
    for (const pe of w.exercises) {
      const ex = exercises.get(pe.exerciseId)
      if (!ex) continue
      const n = working(pe.sets).length
      for (const mm of ex.muscles) m.set(mm.muscleId, (m.get(mm.muscleId) ?? 0) + n * mm.weight)
    }
    perWorkout.set(w.id, m)
  }

  const prevDay = (d: number) => (input.mode === 'plan' ? ((d + 5) % 7) + 1 : d - 1)
  /** Times a week a muscle is trained. A session the day after another counts as half. */
  const spacedFrequency = (muscle: string): number => {
    const days = new Set<number>()
    let undated = 0
    for (const w of workouts) {
      if ((perWorkout.get(w.id)?.get(muscle) ?? 0) < HIT) continue
      if (w.days.length) for (const d of w.days) days.add(d)
      else undated += w.timesPerWeek
    }
    let f = 0
    for (const d of days) f += days.has(prevDay(d)) ? BACK_TO_BACK_CREDIT : 1
    return (input.mode === 'plan' ? f : f / weeks) + undated
  }

  /** Weekly sets with anything past the per-session ceiling counting half. */
  const effective = new Map<string, number>()
  const muscles: MuscleVolume[] = input.muscles.map((goal) => {
    let sets = 0
    let eff = 0
    for (const w of workouts) {
      const v = perWorkout.get(w.id)?.get(goal.id) ?? 0
      sets += v * w.timesPerWeek
      eff +=
        (Math.min(v, PER_SESSION_MAX) + 0.5 * Math.max(0, v - PER_SESSION_MAX)) * w.timesPerWeek
    }
    effective.set(goal.id, eff)
    const frequency = spacedFrequency(goal.id)
    const { min, max } = rangeFor(goal)
    const s = round1(sets)
    const status: MuscleStatus = goal.paused
      ? 'paused'
      : s < min
        ? 'low'
        : s > max * LEEWAY
          ? 'high'
          : 'ok'
    return {
      id: goal.id,
      name: goal.name,
      sets: s,
      frequency: Math.round(frequency * 10) / 10,
      min,
      max,
      priority: goal.priority,
      paused: goal.paused,
      status,
    }
  })
  const vol = (id: string) => muscles.find((m) => m.id === id)?.sets ?? 0
  const trained = muscles.filter((m) => !m.paused)
  const weightOf = (m: MuscleVolume) => (m.priority ? 2 : m.min === 0 ? 0.5 : 1)

  // --- Volume --------------------------------------------------------------
  const volumeScore = weightedMean(
    trained.map((m) => {
      const eff = effective.get(m.id) ?? m.sets
      return {
        w: weightOf(m),
        v:
          m.status === 'high'
            ? Math.max(0, 1 - (m.sets - m.max * LEEWAY) / m.max)
            : m.min > 0
              ? Math.min(1, eff / m.min)
              : 1,
      }
    }),
  )
  const inRange = trained.filter((m) => m.status === 'ok')

  // --- Frequency -----------------------------------------------------------
  const needsFreq = trained.filter((m) => m.min > 0)
  const freqScore = weightedMean(
    needsFreq.map((m) => ({
      w: weightOf(m),
      v: m.frequency >= 1.75 ? 1 : m.frequency >= 0.9 ? 0.6 : m.frequency * 0.6,
    })),
  )
  const onceOnly = needsFreq.filter((m) => m.frequency > 0 && m.frequency < 1.75)

  // --- Balance -------------------------------------------------------------
  const patternSets = (patterns: string[]) => {
    let n = 0
    for (const w of workouts) {
      for (const pe of w.exercises) {
        const ex = exercises.get(pe.exerciseId)
        if (ex && patterns.includes(ex.pattern)) n += working(pe.sets).length * w.timesPerWeek
      }
    }
    return n
  }
  interface Check {
    ok: boolean
    score: number
    good: string
    bad: string
  }
  const checks: Check[] = []
  const ratioCheck = (
    a: number,
    b: number,
    lo: number,
    hi: number,
    good: string,
    bad: (r: number) => string,
  ) => {
    if (a + b === 0 || b === 0) return
    const r = a / b
    const score = r < lo ? r / lo : r > hi ? Math.max(0, 1 - (r - hi) / hi) : 1
    checks.push({ ok: score >= 0.999, score, good, bad: bad(r) })
  }
  const upperActive = ['chest', 'lats'].every((id) => activeIds.has(id))
  if (upperActive) {
    const push = patternSets(['horizontal_push', 'vertical_push'])
    const pull = patternSets(['horizontal_pull', 'vertical_pull'])
    if (push && !pull) {
      checks.push({
        ok: false,
        score: 0,
        good: '',
        bad: 'Lots of pressing but no rows or pulldowns yet.',
      })
    } else {
      ratioCheck(pull, push, 0.9, 1.6, 'Pushing and pulling are nicely balanced.', (r) =>
        r < 0.9
          ? `A bit more pressing than pulling (${fmt(round1(push))} vs ${fmt(round1(pull))} sets) — your shoulders will thank you for an extra row.`
          : `Lots more pulling than pressing (${fmt(round1(pull))} vs ${fmt(round1(push))} sets).`,
      )
    }
    ratioCheck(
      vol('lats') + vol('upper_back') * 0.5,
      vol('chest'),
      0.8,
      2.5,
      'Back keeps up with chest.',
      () =>
        'Chest is getting more work than back — worth evening up for posture and shoulder health.',
    )
  }
  if (activeIds.has('rear_delts') && activeIds.has('front_delts')) {
    ratioCheck(
      vol('rear_delts'),
      vol('front_delts'),
      0.6,
      4,
      'Rear delts get as much love as the fronts.',
      () =>
        'Front delts are well ahead of rear delts — a few more rear delt sets help round the shoulder.',
    )
  }
  if (activeIds.has('quads') && activeIds.has('hamstrings')) {
    ratioCheck(
      vol('hamstrings'),
      vol('quads'),
      0.6,
      1.6,
      'Quads and hamstrings are in balance.',
      (r) =>
        r < 0.6 ? 'Quads are well ahead of hamstrings.' : 'Hamstrings are well ahead of quads.',
    )
  }
  const balanceScore = checks.length ? checks.reduce((a, c) => a + c.score, 0) / checks.length : 1

  // --- Coverage ------------------------------------------------------------
  const usedPatterns = new Set<string>()
  for (const w of workouts) {
    for (const pe of w.exercises) {
      const ex = exercises.get(pe.exerciseId)
      if (ex && working(pe.sets).length) usedPatterns.add(ex.pattern)
    }
  }
  const expected = PATTERNS.filter((p) => p.needs.some((id) => activeIds.has(id)))
  const missing = expected.filter((p) => !usedPatterns.has(p.pattern))
  const coverageScore = expected.length
    ? expected.reduce((a, p) => a + (usedPatterns.has(p.pattern) ? p.weight : 0), 0) /
      expected.reduce((a, p) => a + p.weight, 0)
    : 1

  // --- Recovery ------------------------------------------------------------
  const nextDay = (d: number) => (input.mode === 'plan' ? (d % 7) + 1 : d + 1)
  // Per muscle: the days it gets a hard dose (HEAVY+ sets in one workout), and from which workouts
  const heavy = new Map<string, Map<number, RatingWorkout[]>>()
  for (const w of workouts) {
    for (const [muscle, sets] of perWorkout.get(w.id) ?? []) {
      if (sets < HEAVY || !activeIds.has(muscle)) continue
      const byDay = heavy.get(muscle) ?? new Map<number, RatingWorkout[]>()
      for (const d of w.days) byDay.set(d, [...(byDay.get(d) ?? []), w])
      heavy.set(muscle, byDay)
    }
  }
  // Hard sessions for the same muscle on consecutive days, grouped by the pair of workouts
  const clashes = new Map<string, Clash>()
  /** Back-to-back hard sessions per week, per muscle */
  const backToBackRate = new Map<string, number>()
  for (const [muscle, byDay] of heavy) {
    let n = 0
    for (const [d, ws] of byDay) {
      const nd = nextDay(d)
      const later = nd === d ? undefined : byDay.get(nd)
      if (!later) continue
      n++
      const first = ws[0]!
      const second = later[0]!
      const key = `${first.id}>${second.id}@${d}`
      const c = clashes.get(key) ?? { first, second, day: d, nextDay: nd, muscles: [] }
      c.muscles.push(muscle)
      clashes.set(key, c)
    }
    if (n) backToBackRate.set(muscle, n / weeks)
  }
  const backToBack = trained.filter((m) => backToBackRate.has(m.id))
  // Share of the muscles you're training that get hammered on back-to-back days
  const spacingShare = needsFreq.length
    ? weightedMean(
        needsFreq.map((m) => ({ w: weightOf(m), v: Math.min(1, backToBackRate.get(m.id) ?? 0) })),
      )
    : 0
  const minutes = workouts.map((w) => {
    let seconds = 5 * 60 // warm-up
    for (const pe of w.exercises) {
      const ex = exercises.get(pe.exerciseId)
      seconds += working(pe.sets).length * ((ex?.restSeconds ?? 120) + 40)
    }
    return { w, minutes: Math.round(seconds / 60) }
  })
  const long = minutes.filter((m) => m.minutes > LONG_SESSION_MIN)
  const recoveryScore = Math.max(
    0,
    1 - 0.9 * spacingShare - (workouts.length ? (0.4 * long.length) / workouts.length : 0),
  )
  // Plan mode: the longest stretch with no training at all (e.g. Mon + Tue, then 5 days off)
  const trainingDays = [
    ...new Set(workouts.filter((w) => w.exercises.length).flatMap((w) => w.days)),
  ].toSorted((a, b) => a - b)
  const longestRest =
    input.mode === 'plan' && trainingDays.length > 1
      ? Math.max(
          ...trainingDays.map(
            (d, i) => ((trainingDays[(i + 1) % trainingDays.length]! - d + 7) % 7 || 7) - 1,
          ),
        )
      : 0

  // --- Goal fit ------------------------------------------------------------
  let fit = 0
  let counted = 0
  for (const w of workouts) {
    for (const pe of w.exercises) {
      const ex = exercises.get(pe.exerciseId)
      if (!ex || isTimed(ex.logType)) continue
      for (const s of working(pe.sets)) {
        const lo = s.reps_min ?? s.reps_max
        const hi = s.reps_max ?? s.reps_min
        if (lo === null || hi === null) continue
        counted += w.timesPerWeek
        fit += w.timesPerWeek * setFit(input.focus, ex.isCompound, lo, hi, s.target_rir)
      }
    }
  }
  const goalScore = counted ? fit / counted : 1

  // --- Points --------------------------------------------------------------
  const strengths: string[] = []
  const lacking: Point[] = []
  const overdone: Point[] = []

  const prioritiesOk = trained.filter((m) => m.priority && m.status === 'ok')
  for (const m of prioritiesOk) {
    strengths.push(`${m.name} (a priority): ${fmt(m.sets)} sets a week — right in range.`)
  }
  if (trained.length && inRange.length >= trained.length * 0.6) {
    strengths.push(
      `${inRange.length} of ${trained.length} muscles you're training are in their sweet spot for weekly sets.`,
    )
  }
  if (needsFreq.length && needsFreq.every((m) => m.frequency >= 1.75)) {
    strengths.push('Every muscle gets hit at least twice a week — great for growth.')
  }
  for (const c of checks) if (c.ok) strengths.push(c.good)
  if (workouts.length && !missing.some((p) => p.weight >= 1)) {
    strengths.push('All the main movement patterns are covered.')
  }
  if (workouts.length && backToBack.length === 0 && !long.length) {
    strengths.push(
      'Good recovery: no muscle is hammered on back-to-back days, and sessions are a sensible length.',
    )
  }
  if (counted && goalScore >= 0.85) strengths.push(goalPraise(input.focus))
  const paused = input.muscles.filter((m) => m.paused)
  if (paused.length) {
    strengths.push(
      `Paused muscles (${paused.map((m) => lower(m.name)).join(', ')}) aren't counted against you.`,
    )
  }

  const fixes = new FixBuilder(input, perWorkout)
  for (const m of trained) {
    if (m.status === 'low' && m.min > 0) {
      lacking.push({
        muscleId: m.id,
        text:
          m.sets === 0
            ? `${m.name}: no direct work yet (aim for ${m.min}–${m.max} sets a week).`
            : `${m.name}: ${fmt(m.sets)} sets a week — aim for ${m.min}–${m.max}.`,
        fix: fixes.addForMuscle(m),
      })
    } else if (m.status === 'high') {
      overdone.push({
        muscleId: m.id,
        text: `${m.name}: ${fmt(m.sets)} sets a week — more than ${m.max} rarely adds much and eats into recovery.`,
        fix: fixes.trimForMuscle(m),
      })
    }
  }
  // Missing patterns, unless a muscle fix above already adds one (carries etc. are just a bonus)
  for (const p of missing) {
    if (p.weight < 0.5 || fixes.addedPatterns.has(p.pattern)) continue
    lacking.push({ text: `No ${p.label} yet.`, fix: fixes.addForPattern(p) })
  }
  for (const c of checks) if (!c.ok) lacking.push({ text: c.bad })
  for (const m of onceOnly
    .filter((x) => (x.priority || x.status !== 'low') && !backToBackRate.has(x.id))
    .slice(0, 3)) {
    lacking.push({
      muscleId: m.id,
      text: `${m.name}: trained about once a week — spreading the sets over two days usually works better.`,
    })
  }
  if (backToBack.length) {
    const names = backToBack.map((m, i) => (i ? lower(m.name) : m.name))
    const list =
      names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]
    const worst = [...clashes.values()].toSorted((a, b) => b.muscles.length - a.muscles.length)[0]
    const when =
      input.mode === 'plan' && worst
        ? ` on ${DAYS[worst.day - 1]} and again on ${DAYS[worst.nextDay - 1]}`
        : ' on back-to-back days'
    const gap = longestRest >= 4 ? `, then ${longestRest} days off in a row` : ''
    const point: Point = {
      text: `${list}: trained hard${when}${gap}. Muscles need roughly 48–72 hours to recover from hard sets, so the second day's sets are done tired. Splitting the work by muscle group, or putting a rest day in between, gets more out of the same sets.`,
    }
    if (worst) {
      const regroup = fixes.regroup(worst)
      const move = fixes.moveApart(worst, heavy)
      point.fix = regroup ?? move
      if (regroup && move) point.alternative = move
    }
    // The biggest problem with the plan: say it first
    if (spacingShare >= 0.3) lacking.unshift(point)
    else lacking.push(point)
  }
  // Too much for one muscle in one session
  for (const m of trained) {
    let worst: { w: RatingWorkout; v: number } | null = null
    for (const w of workouts) {
      const v = perWorkout.get(w.id)?.get(m.id) ?? 0
      if (v > PER_SESSION_MAX && (!worst || v > worst.v)) worst = { w, v }
    }
    if (worst) {
      overdone.push({
        muscleId: m.id,
        text: `${m.name}: ${fmt(round1(worst.v))} sets in ${worst.w.name}. Past about ${PER_SESSION_MAX} hard sets for one muscle in a session, extra sets add little — they do more on another day.`,
      })
    }
  }
  for (const l of long) {
    overdone.push({
      text: `${l.w.name} is about ${l.minutes} minutes — long sessions tend to fade at the end. Consider trimming a set or two.`,
    })
  }
  if (counted && goalScore < 0.7) lacking.push({ text: goalAdvice(input.focus) })

  const subscores: SubScore[] = [
    {
      id: 'volume',
      label: 'Volume',
      score: pct(volumeScore),
      summary: `${inRange.length} of ${trained.length} muscles in their weekly set range.`,
    },
    {
      id: 'balance',
      label: 'Balance',
      score: pct(balanceScore),
      summary: checks.length
        ? checks.every((c) => c.ok)
          ? 'Push, pull and shoulders are well balanced.'
          : (checks.find((c) => !c.ok)?.bad ?? '')
        : 'Nothing to compare yet.',
    },
    {
      id: 'frequency',
      label: 'Frequency',
      score: pct(freqScore),
      summary: `${needsFreq.filter((m) => m.frequency >= 1.75).length} of ${needsFreq.length} muscles trained twice a week or more.`,
    },
    {
      id: 'coverage',
      label: 'Coverage',
      score: pct(coverageScore),
      summary: missing.length
        ? `Missing: ${missing.map((p) => p.label.replace(/ \(.*\)/, '')).join(', ')}.`
        : 'All the movement patterns you need are there.',
    },
    {
      id: 'recovery',
      label: 'Recovery',
      score: pct(recoveryScore),
      summary:
        backToBack.length === 0 && !long.length
          ? 'Good spacing and sensible session lengths.'
          : [
              backToBack.length
                ? `${backToBack.length} muscle${backToBack.length === 1 ? '' : 's'} trained hard on back-to-back days`
                : '',
              long.length ? `${long.length} long session(s)` : '',
            ]
              .filter(Boolean)
              .join(' · ') + '.',
    },
    {
      id: 'goal',
      label: 'Goal fit',
      score: pct(goalScore),
      summary: counted ? goalSummary(input.focus, goalScore) : 'No rep targets to check yet.',
    },
  ]
  const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
  const score = workouts.some((w) => w.exercises.length)
    ? Math.round(subscores.reduce((a, s) => a + s.score * WEIGHTS[s.id], 0) / totalWeight)
    : 0

  return {
    score,
    verdict: verdictFor(score),
    subscores,
    muscles,
    strengths: score ? strengths : [],
    lacking,
    overdone,
    workoutsPerWeek: Math.round(workouts.reduce((a, w) => a + w.timesPerWeek, 0) * 10) / 10,
  }
}

function setFit(
  focus: Focus | null,
  compound: boolean,
  lo: number,
  hi: number,
  rir: number | null,
): number {
  if (focus === 'strength') {
    if (compound) return lo <= 6 ? 1 : hi <= 10 ? 0.6 : 0.3
    return lo >= 6 && hi <= 20 ? 1 : 0.6
  }
  if (focus === 'general') return lo >= 3 && hi <= 25 ? 1 : 0.6
  // Muscle building (and fat loss: keep the muscle by training it the same way)
  let s = lo >= 5 && hi <= 30 ? 1 : lo >= 3 ? 0.6 : 0.3
  if (rir !== null && rir > 3) s *= 0.6
  return s
}

function goalPraise(focus: Focus | null): string {
  if (focus === 'strength') return 'Rep ranges suit getting stronger — heavy on the big lifts.'
  if (focus === 'general') return 'Rep ranges suit general fitness.'
  return 'Rep ranges and effort are spot on for building muscle.'
}

function goalAdvice(focus: Focus | null): string {
  if (focus === 'strength')
    return 'For strength, keep a few heavy sets of 3–6 reps on your main lifts.'
  return 'For building muscle, most sets work best at 5–30 reps, within about 3 reps of failure.'
}

function goalSummary(focus: Focus | null, score: number): string {
  const goal =
    focus === 'strength' ? 'strength' : focus === 'general' ? 'general fitness' : 'building muscle'
  return score >= 0.85 ? `Rep ranges suit ${goal}.` : `Some rep ranges don't quite suit ${goal}.`
}

/** Builds one-tap fixes (plan mode only), never suggesting the same exercise twice. */
class FixBuilder {
  private used = new Set<string>()
  readonly addedPatterns = new Set<string>()
  private readonly byName: Map<string, RatingExercise>
  private readonly input: RatingInput
  private readonly perWorkout: Map<string, Map<string, number>>
  constructor(input: RatingInput, perWorkout: Map<string, Map<string, number>>) {
    this.input = input
    this.perWorkout = perWorkout
    this.byName = new Map([...input.exercises.values()].map((e) => [e.name, e]))
  }

  /** The workout whose muscles go best with this one (ties: the shorter workout). */
  private homeFor(muscle: string) {
    const family = FAMILY[muscle] ?? [muscle]
    let best: { w: RatingWorkout; affinity: number; size: number } | null = null
    for (const w of this.input.workouts) {
      const m = this.perWorkout.get(w.id)
      let affinity = 0
      family.forEach((id, i) => (affinity += (m?.get(id) ?? 0) * (family.length - i)))
      const size = w.exercises.reduce((a, pe) => a + working(pe.sets).length, 0)
      if (!best || affinity > best.affinity || (affinity === best.affinity && size < best.size)) {
        best = { w, affinity, size }
      }
    }
    return best?.w ?? null
  }

  private pick(names: readonly string[], w: RatingWorkout): RatingExercise | null {
    for (const name of names) {
      const ex = this.byName.get(name)
      if (!ex || this.used.has(ex.id)) continue
      if (w.exercises.some((pe) => pe.exerciseId === ex.id)) continue
      this.used.add(ex.id)
      this.addedPatterns.add(ex.pattern)
      return ex
    }
    return null
  }

  addForMuscle(m: MuscleVolume): Fix | undefined {
    if (this.input.mode !== 'plan') return undefined
    const w = this.homeFor(m.id)
    if (!w) return undefined
    const sets = Math.min(4, Math.max(2, Math.ceil((m.min - m.sets) / Math.max(1, w.timesPerWeek))))
    // Already has an exercise for it with room for more sets: add sets to that instead
    for (const pe of w.exercises) {
      const ex = this.input.exercises.get(pe.exerciseId)
      const n = working(pe.sets).length
      if (!ex || this.used.has(pe.id) || n >= MAX_SETS_PER_EXERCISE) continue
      if (!ex.muscles.some((x) => x.muscleId === m.id && x.weight >= 1)) continue
      this.used.add(pe.id)
      const next = Math.min(MAX_SETS_PER_EXERCISE, n + sets)
      return {
        kind: 'sets',
        id: `more:${m.id}`,
        text: `Add ${next - n} set${next - n === 1 ? '' : 's'} to ${ex.name} in ${w.name} (${n} → ${next})`,
        workoutId: w.id,
        planExerciseId: pe.id,
        sets: next,
      }
    }
    const ex = this.pick(SUGGEST_FOR_MUSCLE[m.id] ?? [], w)
    if (!ex) return undefined
    return {
      kind: 'add',
      id: `add:${m.id}`,
      text: `Add ${ex.name} (${sets} sets) to ${w.name}`,
      workoutId: w.id,
      exerciseId: ex.id,
      sets,
    }
  }

  addForPattern(p: PatternRule): Fix | undefined {
    if (this.input.mode !== 'plan') return undefined
    const w = this.homeFor(p.home)
    if (!w) return undefined
    const ex = this.pick(p.suggest, w)
    if (!ex) return undefined
    return {
      kind: 'add',
      id: `pattern:${p.pattern}`,
      text: `Add ${ex.name} (3 sets) to ${w.name}`,
      workoutId: w.id,
      exerciseId: ex.id,
      sets: 3,
    }
  }

  trimForMuscle(m: MuscleVolume): Fix | undefined {
    if (this.input.mode !== 'plan') return undefined
    // The planned exercise doing the most for this muscle
    let best: { w: RatingWorkout; peId: string; name: string; n: number; per: number } | null = null
    for (const w of this.input.workouts) {
      for (const pe of w.exercises) {
        const ex = this.input.exercises.get(pe.exerciseId)
        const weight = ex?.muscles.find((x) => x.muscleId === m.id)?.weight ?? 0
        const n = working(pe.sets).length
        const per = weight * w.timesPerWeek
        if (!ex || weight < 1 || n < 3) continue
        if (!best || n * per > best.n * best.per) best = { w, peId: pe.id, name: ex.name, n, per }
      }
    }
    if (!best) return undefined
    const drop = Math.min(best.n - 2, Math.max(1, Math.ceil((m.sets - m.max) / best.per)))
    return {
      kind: 'sets',
      id: `trim:${m.id}`,
      text: `Drop ${drop} set${drop === 1 ? '' : 's'} of ${best.name} in ${best.w.name} (${best.n} → ${best.n - drop})`,
      workoutId: best.w.id,
      planExerciseId: best.peId,
      sets: best.n - drop,
    }
  }

  /** Turns two mixed workouts into a push day and a pull day. Supersets move together. */
  regroup(c: Clash): Fix | undefined {
    if (this.input.mode !== 'plan' || c.first.id === c.second.id) return undefined
    const units = (w: RatingWorkout) => {
      const map = new Map<string, { ids: string[]; push: number; pull: number }>()
      for (const pe of w.exercises) {
        const ex = this.input.exercises.get(pe.exerciseId)
        const n = working(pe.sets).length
        const key = pe.groupId ?? pe.id
        const u = map.get(key) ?? { ids: [], push: 0, pull: 0 }
        u.ids.push(pe.id)
        for (const m of ex?.muscles ?? []) {
          if (PUSH_MUSCLES.includes(m.muscleId)) u.push += n * m.weight
          if (PULL_MUSCLES.includes(m.muscleId)) u.pull += n * m.weight
        }
        map.set(key, u)
      }
      return [...map.values()]
    }
    const a = units(c.first)
    const b = units(c.second)
    const lean = (us: typeof a) => {
      const push = us.reduce((s, u) => s + u.push, 0)
      const pull = us.reduce((s, u) => s + u.pull, 0)
      return { push, pull, mixed: push + pull > 0 && Math.min(push, pull) >= 0.25 * (push + pull) }
    }
    const la = lean(a)
    const lb = lean(b)
    if (!la.mixed || !lb.mixed) return undefined
    // The workout already leaning more towards pressing becomes the push day
    const aIsPush = la.push - la.pull >= lb.push - lb.pull
    const [pushW, pullW] = aIsPush ? [c.first, c.second] : [c.second, c.first]
    const [pushUnits, pullUnits] = aIsPush ? [a, b] : [b, a]
    const moves = [
      ...pushUnits
        .filter((u) => u.pull > u.push)
        .flatMap((u) => u.ids.map((planExerciseId) => ({ planExerciseId, toWorkoutId: pullW.id }))),
      ...pullUnits
        .filter((u) => u.push > u.pull)
        .flatMap((u) => u.ids.map((planExerciseId) => ({ planExerciseId, toWorkoutId: pushW.id }))),
    ]
    if (!moves.length) return undefined
    return {
      kind: 'regroup',
      id: `regroup:${c.first.id}:${c.second.id}`,
      text: `Keep both days, but make ${pushW.name} your push workout (chest, shoulders, triceps) and ${pullW.name} your pull workout (back, biceps, rear delts) — moves ${moves.length} exercise${moves.length === 1 ? '' : 's'}`,
      moves,
    }
  }

  /** Moves the second workout to the day that leaves the clashing muscles the most rest. */
  moveApart(
    c: Clash,
    heavy: ReadonlyMap<string, ReadonlyMap<number, RatingWorkout[]>>,
  ): Fix | undefined {
    if (this.input.mode !== 'plan') return undefined
    const w = c.second
    const from = c.nextDay
    // Other hard days for those muscles, once this one has moved
    const busy = new Set<number>()
    for (const m of c.muscles) {
      for (const [d, ws] of heavy.get(m) ?? []) {
        if (!(d === from && ws.every((x) => x.id === w.id))) busy.add(d)
      }
    }
    const anyTraining = new Set(this.input.workouts.flatMap((x) => x.days))
    let best: { day: number; gap: number; free: boolean } | null = null
    for (let t = 1; t <= 7; t++) {
      if (t === from || w.days.includes(t)) continue
      const gap = Math.min(...[...busy].map((d) => dist(t, d)))
      if (gap < 2) continue
      const free = !anyTraining.has(t)
      if (!best || gap > best.gap || (gap === best.gap && free && !best.free)) {
        best = { day: t, gap, free }
      }
    }
    if (!best) return undefined
    const rest = best.gap - 1
    return {
      kind: 'move',
      id: `move:${w.id}:${from}`,
      text: `Move ${w.name} from ${DAYS[from - 1]} to ${DAYS[best.day - 1]} (at least ${rest} rest day${rest === 1 ? '' : 's'} in between)`,
      workoutId: w.id,
      fromDay: from,
      toDay: best.day,
    }
  }
}

export interface MuscleGap {
  id: string
  name: string
  planned: number
  actual: number
}

/** Muscles where what you logged differs from the plan by 3+ sets a week, biggest first. */
export function planVsActual(plan: Rating, actual: Rating): MuscleGap[] {
  return plan.muscles
    .filter((m) => !m.paused)
    .map((m) => ({
      id: m.id,
      name: m.name,
      planned: m.sets,
      actual: actual.muscles.find((a) => a.id === m.id)?.sets ?? 0,
    }))
    .filter((g) => Math.abs(g.planned - g.actual) >= 3)
    .toSorted((a, b) => Math.abs(b.planned - b.actual) - Math.abs(a.planned - a.actual))
}
