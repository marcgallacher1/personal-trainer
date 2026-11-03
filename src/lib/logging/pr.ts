import { e1rm } from '../analysis/e1rm'
import { isTimed, type LogType, type SetType } from './types'

export interface SetPoint {
  weight_kg: number
  reps: number
  duration_seconds?: number | null
  set_type: SetType
}

export type PR =
  | { kind: 'e1rm'; value: number; previous: number }
  | { kind: 'weight'; value: number; previous: number }
  /** No earlier set was at least as hard on load *and* effort (reps or time). */
  | { kind: 'best_at_load'; logType: LogType; weight: number; reps: number; seconds: number }

/** Reps for rep-based types, seconds for timed ones. */
const effort = (s: SetPoint, t: LogType) => (isTimed(t) ? (s.duration_seconds ?? 0) : s.reps)

/**
 * PBs this set beats vs all earlier sets. Never on the first go; warm-ups don't count.
 * For assisted exercises, less assistance is harder.
 */
export function detectPRs(
  candidate: SetPoint,
  history: readonly SetPoint[],
  logType: LogType = 'weight_reps',
): PR[] {
  const counts = (s: SetPoint) => s.set_type !== 'warmup' && effort(s, logType) > 0
  if (!counts(candidate)) return []
  const prior = history.filter(counts)
  if (prior.length === 0) return []

  const prs: PR[] = []
  const EPS = 1e-6

  if (logType === 'weight_reps') {
    const cand1rm = e1rm(candidate.weight_kg, candidate.reps)
    const best1rm = Math.max(0, ...prior.map((s) => e1rm(s.weight_kg, s.reps) ?? 0))
    if (cand1rm !== null && best1rm > 0 && cand1rm > best1rm + EPS) {
      prs.push({ kind: 'e1rm', value: cand1rm, previous: best1rm })
    }
  }

  if (logType === 'weight_reps' || logType === 'weight_duration') {
    const bestWeight = Math.max(...prior.map((s) => s.weight_kg))
    if (candidate.weight_kg > 0 && candidate.weight_kg > bestWeight + EPS) {
      prs.push({ kind: 'weight', value: candidate.weight_kg, previous: bestWeight })
    }
  }

  const candEffort = effort(candidate, logType)
  const atLeastAsHard = (s: SetPoint) =>
    logType === 'assisted_reps'
      ? s.weight_kg <= candidate.weight_kg + EPS
      : s.weight_kg >= candidate.weight_kg - EPS
  const dominated = prior.some((s) => atLeastAsHard(s) && effort(s, logType) >= candEffort)
  if (!dominated) {
    prs.push({
      kind: 'best_at_load',
      logType,
      weight: candidate.weight_kg,
      reps: candidate.reps,
      seconds: candidate.duration_seconds ?? 0,
    })
  }

  return prs
}

const kg = (n: number) => `${Math.round(n * 10) / 10} kg`

/** "45 s", "1:30" */
export function formatSeconds(total: number): string {
  if (total < 60) return `${total} s`
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function describePR(pr: PR): string {
  switch (pr.kind) {
    case 'e1rm':
      return `Strongest yet: about ${kg(pr.value)} for 1 rep (was ${kg(pr.previous)})`
    case 'weight':
      return `Heaviest ever: ${kg(pr.value)}`
    case 'best_at_load': {
      const { logType, weight, reps, seconds } = pr
      switch (logType) {
        case 'weight_reps':
          return weight > 0 ? `Best ever at ${kg(weight)}: ${reps} reps` : `Most reps ever: ${reps}`
        case 'bodyweight_reps':
          return weight > 0
            ? `Best ever with +${kg(weight)}: ${reps} reps`
            : `Most reps ever: ${reps}`
        case 'assisted_reps':
          return `Best ever with ${kg(weight)} assistance: ${reps} reps`
        case 'duration':
          return weight > 0
            ? `Longest ever with +${kg(weight)}: ${formatSeconds(seconds)}`
            : `Longest ever: ${formatSeconds(seconds)}`
        case 'weight_duration':
          return `Longest ever at ${kg(weight)}: ${formatSeconds(seconds)}`
      }
    }
  }
}
