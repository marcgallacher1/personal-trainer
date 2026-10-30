/**
 * Plan rating: scores a week of training out of 100 with explained sub-scores, what's going well,
 * what's lacking or overdone, and concrete fixes. Pure — the same engine rates a plan (projected
 * week) or the last few weeks of logged training. Paused muscles are left out entirely; priority
 * muscles count double and aim higher.
 */
import { isTimed, type LogType } from '../logging/types'
import type { TargetLike } from '../plans/targets'
import {
  DEFAULT_RANGES,
  FAMILY,
  GENERIC_RANGE,
  PATTERNS,
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
  exercises: readonly { id: string; exerciseId: string; sets: readonly TargetLike[] }[]
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

export interface Point {
  text: string
  muscleId?: string
  fix?: Fix
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

const WEIGHTS: Record<SubScoreId, number> = {
  volume: 30,
  balance: 15,
  frequency: 15,
  coverage: 10,
  recovery: 15,
  goal: 15,
}

/** Sets in one workout that count as "training" a muscle that day. */
const HIT = 1.5
/** Sets in one day that make a muscle need a rest day after. */
const HEAVY = 4
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

  const muscles: MuscleVolume[] = input.muscles.map((goal) => {
    let sets = 0
    let frequency = 0
    for (const w of workouts) {
      const v = perWorkout.get(w.id)?.get(goal.id) ?? 0
      sets += v * w.timesPerWeek
      if (v >= HIT) frequency += w.timesPerWeek
    }
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
    trained.map((m) => ({
      w: weightOf(m),
      v:
        m.status === 'ok'
          ? 1
          : m.status === 'low'
            ? m.sets / m.min
            : Math.max(0, 1 - (m.sets - m.max * LEEWAY) / m.max),
    })),
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
  const heavyDays = new Map<string, Set<number>>()
  for (const w of workouts) {
    for (const [muscle, sets] of perWorkout.get(w.id) ?? []) {
      if (sets < HEAVY || !activeIds.has(muscle)) continue
      const days = heavyDays.get(muscle) ?? new Set<number>()
      for (const d of w.days) days.add(d)
      heavyDays.set(muscle, days)
    }
  }
  const backToBack: string[] = []
  let pairs = 0
  for (const [muscle, days] of heavyDays) {
    let n = 0
    for (const d of days) {
      const next = input.mode === 'plan' ? (d % 7) + 1 : d + 1
      if (days.has(next) && next !== d) n++
    }
    if (n) {
      pairs += n
      backToBack.push(muscles.find((m) => m.id === muscle)?.name ?? muscle)
    }
  }
  const pairsPerWeek = pairs / weeks
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
    1 - 0.12 * pairsPerWeek - (workouts.length ? (0.4 * long.length) / workouts.length : 0),
  )

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
  if (workouts.length && pairsPerWeek === 0 && !long.length) {
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
  for (const m of onceOnly.filter((x) => x.priority || x.status !== 'low').slice(0, 3)) {
    lacking.push({
      muscleId: m.id,
      text: `${m.name}: trained about once a week — spreading the sets over two days usually works better.`,
    })
  }
  if (backToBack.length) {
    lacking.push({
      text: `${backToBack.join(', ')} get hit hard on back-to-back days — a day's rest between helps them recover.`,
    })
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
        pairsPerWeek === 0 && !long.length
          ? 'Good spacing and sensible session lengths.'
          : [
              backToBack.length ? `${backToBack.length} muscle(s) on back-to-back days` : '',
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
