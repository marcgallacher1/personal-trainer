/**
 * "Today's target" by double progression: add reps until every set hits the top of the range,
 * then add weight and drop back to the bottom of the range.
 */
import { isTimed, type LogType } from '../logging/types'

/** Weight added once the top of the range is hit on every set. */
export const INCREMENT = { compound: 2.5, isolation: 1 } as const

export interface LastSet {
  weightKg: number
  reps: number
  rir: number | null
  setType: string
}

export interface TargetInput {
  /** Last workout's sets for this exercise (null if never done) */
  last: readonly LastSet[] | null
  repsMin: number | null
  repsMax: number | null
  targetRir: number | null
  isCompound: boolean
  logType: LogType
  /** A reset weight you accepted after a stall, if newer than the last workout */
  resetKg?: number | null
}

export interface TodaysTarget {
  /** null for bodyweight moves */
  weightKg: number | null
  reps: number
  /** Short reason, e.g. "You hit 12 on every set last time" */
  why: string
  /** True when the target adds weight */
  heavier: boolean
}

const fmt = (n: number) => `${Math.round(n * 100) / 100}`

/** Readable target, e.g. "62.5 kg × 8" or "10 reps". */
export function describeTarget(t: TodaysTarget): string {
  return t.weightKg === null ? `${t.reps} reps` : `${fmt(t.weightKg)} kg × ${t.reps}`
}

export function todaysTarget(input: TargetInput): TodaysTarget | null {
  const { last, repsMin, repsMax, targetRir, logType } = input
  if (isTimed(logType)) return null
  const working = (last ?? []).filter((s) => s.setType !== 'warmup' && s.reps > 0)
  const top = repsMax ?? repsMin
  const bottom = repsMin ?? repsMax

  if (input.resetKg && bottom) {
    return {
      weightKg: input.resetKg,
      reps: bottom,
      why: 'Reset after a stall. Build back up from here.',
      heavier: false,
    }
  }
  if (!working.length || !top || !bottom) return null

  const bodyweight = logType === 'bodyweight_reps'
  const assisted = logType === 'assisted_reps'
  // The main weight: heaviest for normal lifts, lightest assistance for assisted ones
  const weight = assisted
    ? Math.min(...working.map((s) => s.weightKg))
    : Math.max(...working.map((s) => s.weightKg))
  const main = working.filter((s) => s.weightKg === weight)
  const lowest = Math.min(...main.map((s) => s.reps))
  const allTop = working.every((s) => s.reps >= top)
  // Ground out well past the target effort? Repeat before adding weight
  const tooHard =
    targetRir !== null && main.some((s) => s.rir !== null && s.rir < Math.max(0, targetRir - 1))
  const step = input.isCompound ? INCREMENT.compound : INCREMENT.isolation

  if (bodyweight || weight <= 0) {
    return allTop
      ? {
          weightKg: null,
          reps: top + 1,
          why: `You hit ${top} on every set. Go for one more.`,
          heavier: false,
        }
      : {
          weightKg: null,
          reps: Math.min(top, lowest + 1),
          why: `Beat last time by a rep.`,
          heavier: false,
        }
  }

  if (allTop && !tooHard) {
    const next = assisted ? Math.max(0, weight - step) : weight + step
    return {
      weightKg: next,
      reps: bottom,
      why: assisted
        ? `You hit ${top} on every set. Take ${fmt(step)} kg less help.`
        : `You hit ${top} on every set last time. Time to go up.`,
      heavier: true,
    }
  }
  if (allTop) {
    return {
      weightKg: weight,
      reps: top,
      why: 'You hit the reps but it was a grind. Repeat it, then go up.',
      heavier: false,
    }
  }
  return {
    weightKg: weight,
    reps: Math.min(top, lowest + 1),
    why: `Add a rep. Once every set hits ${top}, the weight goes up.`,
    heavier: false,
  }
}
