import { e1rm } from '../analysis/e1rm'
import type { SetType } from './types'

export interface SetPoint {
  weight_kg: number
  reps: number
  set_type: SetType
}

export type PR =
  | { kind: 'e1rm'; value: number; previous: number }
  | { kind: 'weight'; value: number; previous: number }
  /** No earlier set had at least this weight *and* at least these reps. */
  | { kind: 'reps_at_weight'; weight: number; reps: number }

const counts = (s: SetPoint) => s.set_type !== 'warmup' && s.reps > 0

/**
 * PRs a set beats, compared with every earlier set of the same exercise.
 * The first time you do an exercise isn't treated as a PR. Warm-ups never count. Most notable first.
 */
export function detectPRs(candidate: SetPoint, history: readonly SetPoint[]): PR[] {
  if (!counts(candidate)) return []
  const prior = history.filter(counts)
  if (prior.length === 0) return []

  const prs: PR[] = []
  const EPS = 1e-6

  const cand1rm = e1rm(candidate.weight_kg, candidate.reps)
  const best1rm = Math.max(0, ...prior.map((s) => e1rm(s.weight_kg, s.reps) ?? 0))
  if (cand1rm !== null && best1rm > 0 && cand1rm > best1rm + EPS) {
    prs.push({ kind: 'e1rm', value: cand1rm, previous: best1rm })
  }

  const bestWeight = Math.max(...prior.map((s) => s.weight_kg))
  if (candidate.weight_kg > 0 && candidate.weight_kg > bestWeight + EPS) {
    prs.push({ kind: 'weight', value: candidate.weight_kg, previous: bestWeight })
  }

  const dominated = prior.some(
    (s) => s.weight_kg >= candidate.weight_kg - EPS && s.reps >= candidate.reps,
  )
  if (!dominated) {
    prs.push({ kind: 'reps_at_weight', weight: candidate.weight_kg, reps: candidate.reps })
  }

  return prs
}

const kg = (n: number) => `${Math.round(n * 10) / 10} kg`

export function describePR(pr: PR): string {
  switch (pr.kind) {
    case 'e1rm':
      return `New e1RM: ${kg(pr.value)} (was ${kg(pr.previous)})`
    case 'weight':
      return `Heaviest ever: ${kg(pr.value)}`
    case 'reps_at_weight':
      return pr.weight > 0
        ? `Best ever at ${kg(pr.weight)}: ${pr.reps} reps`
        : `Most reps ever: ${pr.reps}`
  }
}
