/**
 * Coaching suggestions. Nothing here changes the plan: each suggestion offers choices you accept
 * or turn down, and the app applies only what you accept.
 */
import { swapCredit } from '../analysis/adherence'
import { actualMuscles, type MuscleContext } from '../analysis/muscles'
import { exerciseTrend, strengthSeries } from '../analysis/strength'
import { addDays, weekdayOf, weekOf, type TrainingSession } from '../analysis/training'
import type { Fix, Rating, RatingWorkout } from '../rating/rate'
import { suggestWorkout, weekDone } from '../plans/suggest'
import { INCREMENT } from './progression'

export type ProposalAction =
  | { kind: 'fix'; fix: Fix }
  | { kind: 'swap'; planExerciseId: string; exerciseId: string }
  | { kind: 'reps'; planExerciseId: string; repsMin: number; repsMax: number }
  | { kind: 'reset'; exerciseId: string; weightKg: number }
  /** Do a missed workout on another day this week */
  | { kind: 'reschedule'; workoutId: string; date: string }
  /** Add a missed workout's key lifts to another workout */
  | { kind: 'fold'; workoutId: string; intoWorkoutId: string; date: string; exerciseIds: string[] }

export interface ProposalOption {
  id: string
  label: string
  action: ProposalAction
}

export type ProposalKind = 'missed' | 'stall' | 'rebalance' | 'trim'

export interface Proposal {
  /** Stable, so a decision isn't asked again */
  key: string
  kind: ProposalKind
  title: string
  detail: string
  options: ProposalOption[]
}

export interface ProposalInput {
  today: string
  sessions: readonly TrainingSession[]
  ctx: MuscleContext
  plan: {
    id: string
    workouts: readonly RatingWorkout[]
    /** First day the plan was in use */
    since: string
    rating: Rating
  }
  /** Keys you've already accepted or turned down */
  decided: ReadonlySet<string>
}

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_STALLS = 2
/** A stall only counts if the lift was done this recently */
const STALL_FRESH_DAYS = 21

const roundTo = (n: number, step: number) => Math.round(n / step) * step
const working = (w: RatingWorkout['exercises'][number]) =>
  w.sets.filter((s) => s.set_type !== 'warmup')

export function buildProposals(input: ProposalInput): Proposal[] {
  const out = [...missed(input), ...stalls(input), ...rebalance(input)]
  return out.filter((p) => !input.decided.has(p.key) && p.options.length > 0)
}

/** Planned workouts from earlier this week that weren't done. */
function missed({ today, sessions, ctx, plan }: ProposalInput): Proposal[] {
  const monday = weekOf(today)
  const todayN = weekdayOf(today)
  const from = plan.since > monday ? plan.since : monday
  if (todayN === 1 || from >= today) return []

  const asSuggest = {
    today,
    workouts: plan.workouts.map((x) => ({
      id: x.id,
      name: x.name,
      days: x.days,
      exerciseIds: x.exercises.map((e) => e.exerciseId),
    })),
    sessions: sessions
      .filter((s) => s.date >= from)
      .map((s) => ({ date: s.date, workoutId: s.planSessionId, sets: s.sets })),
    info: ctx.exercises,
  }
  // Done this week so far: the same count Start workout uses, so the two never disagree.
  // A workout on another day, or a custom one that trained the same muscles, still counts.
  const doneCount = weekDone(asSuggest)
  const left = (w: RatingWorkout) => Math.max(1, w.days.length) - (doneCount.get(w.id) ?? 0)
  const dateOf = (day: number) => addDays(monday, day - 1)
  const trainedToday = sessions.some((s) => s.date === today)
  // A day is taken only by a workout that still needs doing this week
  const busy = (d: number) => plan.workouts.some((x) => x.days.includes(d) && left(x) > 0)
  // What Start workout suggests today; no point also nagging about it here
  const suggested = suggestWorkout({ ...asSuggest, muscleName: (id) => id })?.workoutId

  const out: Proposal[] = []
  for (const w of plan.workouts) {
    const passed = w.days.filter((d) => d < todayN && dateOf(d) >= from).toSorted((a, b) => a - b)
    if (passed.length <= (doneCount.get(w.id) ?? 0) || left(w) <= 0) continue
    if (w.id === suggested) continue
    const missedDay = passed.at(-1)!
    const options: ProposalOption[] = []

    // Next free day from today on (today only if nothing's been done yet)
    for (let d = todayN; d <= 7; d++) {
      if (d === todayN ? trainedToday || busy(d) : busy(d)) continue
      options.push({
        id: 'reschedule',
        label: d === todayN ? 'Do it today' : `Move to ${DAY[d - 1]}`,
        action: { kind: 'reschedule', workoutId: w.id, date: dateOf(d) },
      })
      break
    }

    // Or fold its key lifts into the next planned workout
    const next = plan.workouts
      .flatMap((x) => x.days.filter((d) => d >= todayN).map((d) => ({ x, d })))
      // Only a workout you'll still do this week
      .filter(({ x, d }) => x.id !== w.id && left(x) > 0 && !(d === todayN && trainedToday))
      .toSorted((a, b) => a.d - b.d)[0]
    if (next) {
      const already = new Set(next.x.exercises.map((e) => e.exerciseId))
      const candidates = w.exercises.filter((e) => !already.has(e.exerciseId))
      const compounds = candidates.filter((e) => ctx.exercises.get(e.exerciseId)?.isCompound)
      const lifts = (compounds.length ? compounds : candidates).slice(0, 2)
      if (lifts.length) {
        const names = lifts.map((e) => ctx.exercises.get(e.exerciseId)?.name ?? 'Exercise')
        options.push({
          id: 'fold',
          label: `Add ${names.join(' + ')} to ${next.x.name}`,
          action: {
            kind: 'fold',
            workoutId: w.id,
            intoWorkoutId: next.x.id,
            date: dateOf(next.d),
            exerciseIds: lifts.map((e) => e.exerciseId),
          },
        })
      }
    }

    out.push({
      key: `missed:${w.id}:${dateOf(missedDay)}`,
      kind: 'missed',
      title: `You missed ${w.name}`,
      detail: `It was planned for ${DAY[missedDay - 1]}. Fit it in rather than skip it.`,
      options,
    })
  }
  return out
}

/** Lifts with no new best in 3+ workouts. */
function stalls({ today, sessions, ctx, plan }: ProposalInput): Proposal[] {
  const inPlan = new Set(plan.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)))
  const seen = new Set<string>()
  const out: Proposal[] = []
  for (const w of plan.workouts) {
    for (const pe of w.exercises) {
      if (seen.has(pe.exerciseId)) continue
      seen.add(pe.exerciseId)
      const ex = ctx.exercises.get(pe.exerciseId)
      if (!ex) continue
      const series = strengthSeries(sessions, pe.exerciseId)
      const trend = exerciseTrend(pe.exerciseId, series)
      const lastDate = series.at(-1)?.date ?? ''
      if (!trend?.stalled || lastDate < addDays(today, -STALL_FRESH_DAYS)) continue

      const best = series.reduce((a, p) => (p.e1rm > a.e1rm ? p : a))
      const step = ex.isCompound ? INCREMENT.compound : INCREMENT.isolation
      const reset = roundTo(best.weightKg * 0.9, step)
      const options: ProposalOption[] = []
      if (reset > 0) {
        options.push({
          id: 'reset',
          label: `Drop to ${reset} kg and build back up`,
          action: { kind: 'reset', exerciseId: ex.id, weightKg: reset },
        })
      }
      const first = working(pe)[0]
      const top = first?.reps_max ?? 0
      if (top > 0) {
        const [lo, hi] = top >= 10 ? [6, 8] : [10, 12]
        options.push({
          id: 'reps',
          label: `Switch to ${lo}–${hi} reps`,
          action: { kind: 'reps', planExerciseId: pe.id, repsMin: lo, repsMax: hi },
        })
      }
      const swap = [...ctx.exercises.values()]
        .filter(
          (c) => !inPlan.has(c.id) && c.logType === ex.logType && swapCredit(ex, c).kind === 'fair',
        )
        .toSorted((a, b) => a.name.localeCompare(b.name))[0]
      if (swap) {
        options.push({
          id: 'swap',
          label: `Swap to ${swap.name}`,
          action: { kind: 'swap', planExerciseId: pe.id, exerciseId: swap.id },
        })
      }
      out.push({
        key: `stall:${ex.id}:${best.date}:${Math.floor(trend.sinceBest / 3)}`,
        kind: 'stall',
        title: `${ex.name} has stalled`,
        detail: `No new best in ${trend.sinceBest} workouts. A change usually gets it moving again.`,
        options,
      })
      if (out.length >= MAX_STALLS) return out
    }
  }
  return out
}

/** Muscles under (or over) target two weeks running, when the plan itself is the cause. */
function rebalance({ today, sessions, ctx, plan }: ProposalInput): Proposal[] {
  const lastWeek = addDays(weekOf(today), -7)
  const weeks = [addDays(lastWeek, -7), lastWeek]
  if (weeks[0]! < weekOf(plan.since)) return []
  const [a, b] = weeks.map((w) =>
    actualMuscles(
      sessions.filter((s) => s.date >= w && s.date <= addDays(w, 6)),
      ctx,
      1,
    ),
  )
  if (!a || !b) return []
  const out: Proposal[] = []

  for (const point of plan.rating.lacking) {
    const m = point.muscleId
    const fix = point.fix
    if (!m || !fix || (fix.kind !== 'add' && fix.kind !== 'sets')) continue
    const x = a.find((v) => v.id === m)
    const y = b.find((v) => v.id === m)
    if (x?.status !== 'low' || y?.status !== 'low') continue
    out.push({
      key: `low:${m}:${lastWeek}`,
      kind: 'rebalance',
      title: `More ${y.name.toLowerCase()} work`,
      detail: `Under your ${y.min} sets two weeks running (${x.sets} and ${y.sets}).`,
      options: [{ id: 'fix', label: fix.text, action: { kind: 'fix', fix } }],
    })
  }

  // Too much for a muscle, and its lifts aren't progressing
  for (const point of plan.rating.overdone) {
    const m = point.muscleId
    const fix = point.fix
    if (!m || !fix || fix.kind !== 'sets') continue
    const x = a.find((v) => v.id === m)
    const y = b.find((v) => v.id === m)
    if (x?.status !== 'high' || y?.status !== 'high') continue
    const stuck = plan.workouts.some((w) =>
      w.exercises.some((e) => {
        const ex = ctx.exercises.get(e.exerciseId)
        if (!ex?.muscles.some((mm) => mm.muscleId === m && mm.weight >= 1)) return false
        return exerciseTrend(e.exerciseId, strengthSeries(sessions, e.exerciseId))?.stalled
      }),
    )
    if (!stuck) continue
    out.push({
      key: `trim:${m}:${lastWeek}`,
      kind: 'trim',
      title: `Less ${y.name.toLowerCase()} volume`,
      detail: `Over your ${y.max} sets two weeks running and not progressing. Fewer sets should recover better.`,
      options: [{ id: 'fix', label: fix.text, action: { kind: 'fix', fix } }],
    })
  }
  return out
}
