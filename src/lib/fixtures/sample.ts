/**
 * Plausible fake training history, for development and tests: follows a plan most weeks, with
 * the odd missed or moved day, fair exercise swaps, steady progress, and one lift that stalls.
 * Deterministic for a given seed.
 */
import { swapCredit } from '../analysis/adherence'
import { addDays, weekOf, type ExerciseInfo } from '../analysis/training'
import { isTimed } from '../logging/types'

export interface SamplePlanWorkout {
  id: string
  name: string
  /** ISO weekdays; empty = any day */
  days: readonly number[]
  exercises: readonly { exerciseId: string; sets: number; repsMin: number; repsMax: number }[]
}

export interface SampleSet {
  weightKg: number
  reps: number
  seconds: number | null
  rir: number
}

export interface SampleSession {
  date: string
  startedAt: string
  endedAt: string
  name: string
  planSessionId: string
  exercises: { exerciseId: string; sets: SampleSet[] }[]
}

/** Small, fast, seedable PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step)

/** A believable starting e1RM for an exercise, kg. */
function baseE1rm(e: ExerciseInfo, rand: () => number): number {
  const big = e.muscles.some(
    (m) =>
      m.weight >= 1 &&
      ['lats', 'chest', 'upper_back', 'quads', 'glutes', 'hamstrings'].includes(m.muscleId),
  )
  const base = e.isCompound ? (big ? 85 : 45) : big ? 40 : 18
  return base * (0.85 + rand() * 0.3)
}

export function generateSampleHistory(opts: {
  plan: readonly SamplePlanWorkout[]
  info: ReadonlyMap<string, ExerciseInfo>
  today: string
  weeks?: number
  seed?: number
  /** Chance a planned workout is done (default 0.85) */
  attendance?: number
}): SampleSession[] {
  const { plan, info, today } = opts
  const weeks = opts.weeks ?? 12
  const rand = rng(opts.seed ?? 42)
  const attendance = opts.attendance ?? 0.85
  const catalogue = [...info.values()]

  // Workouts with no set day get spread through the week
  const free = [2, 4, 6, 1, 3, 5, 7]
  const schedule = plan.map((w, i) => ({ w, days: w.days.length ? w.days : [free[i % 7]!] }))

  // The first exercise of the second workout stalls halfway through
  const stalled = plan[1]?.exercises[0]?.exerciseId ?? plan[0]?.exercises[0]?.exerciseId
  const strength = new Map<string, number>()
  const strengthOf = (e: ExerciseInfo) => {
    if (!strength.has(e.id)) strength.set(e.id, baseE1rm(e, rand))
    return strength.get(e.id)!
  }

  const out: SampleSession[] = []
  const firstWeek = addDays(weekOf(today), -7 * (weeks - 1))
  for (let wk = 0; wk < weeks; wk++) {
    const monday = addDays(firstWeek, 7 * wk)
    for (const { w, days } of schedule) {
      for (const day of days) {
        if (rand() > attendance) continue
        const shift = rand() < 0.15 ? (rand() < 0.5 ? -1 : 1) : 0
        const date = addDays(monday, Math.min(6, Math.max(0, day - 1 + shift)))
        if (date >= today) continue

        const exercises: SampleSession['exercises'] = []
        for (const pe of w.exercises) {
          let ex = info.get(pe.exerciseId)
          if (!ex) continue
          const roll = rand()
          if (roll < 0.04) continue // skipped
          if (roll < 0.14) {
            // Machine taken: a fair swap
            const swaps = catalogue.filter(
              (c) => c.id !== ex!.id && swapCredit(ex!, c).kind === 'fair',
            )
            if (swaps.length) ex = swaps[Math.floor(rand() * swaps.length)]!
          }
          // Progress ~1%/week; the stalled lift flattens out after week 6
          const growth = 1 + 0.01 * (ex.id === stalled ? Math.min(wk, 6) : wk)
          const top = strengthOf(ex) * growth * (0.97 + rand() * 0.05)
          const nSets = pe.sets - (rand() < 0.12 ? 1 : 0)
          const sets: SampleSet[] = []
          for (let i = 0; i < Math.max(1, nSets); i++) {
            const reps = Math.max(
              pe.repsMin,
              Math.min(pe.repsMax, Math.round(pe.repsMax - i - rand() * 2)),
            )
            const rir = Math.min(3, Math.floor(rand() * 3))
            if (isTimed(ex.logType)) {
              sets.push({
                weightKg: ex.logType === 'weight_duration' ? roundTo(top / 3, 2) : 0,
                reps: 0,
                seconds: 30 + 5 * Math.round(rand() * 6) + wk,
                rir,
              })
            } else if (ex.logType === 'bodyweight_reps') {
              sets.push({
                weightKg: 0,
                reps: Math.round(8 + wk / 3 - i + rand() * 2),
                seconds: null,
                rir,
              })
            } else if (ex.logType === 'assisted_reps') {
              sets.push({
                weightKg: roundTo(Math.max(5, 40 - wk * 1.5), 2.5),
                reps,
                seconds: null,
                rir,
              })
            } else {
              sets.push({ weightKg: roundTo(top / (1 + reps / 30), 2.5), reps, seconds: null, rir })
            }
          }
          exercises.push({ exerciseId: ex.id, sets })
        }
        if (!exercises.length) continue
        const hour = 17 + Math.floor(rand() * 3)
        const startedAt = `${date}T${String(hour).padStart(2, '0')}:${String(Math.floor(rand() * 50)).padStart(2, '0')}:00.000Z`
        const total = exercises.reduce((a, e) => a + e.sets.length, 0)
        const endedAt = new Date(
          Date.parse(startedAt) + (total * 2.6 + 6 + rand() * 8) * 60_000,
        ).toISOString()
        out.push({ date, startedAt, endedAt, name: w.name, planSessionId: w.id, exercises })
      }
    }
  }
  return out.toSorted((a, b) => a.startedAt.localeCompare(b.startedAt))
}
