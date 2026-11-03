/** Turning a set's weight into real load: each dumbbell counts, and left/right are added up. */
import { e1rm } from '../analysis/e1rm'
import type { LoadMode } from './types'

export interface SidedSet {
  weight_kg: number
  reps: number
  right_weight_kg?: number | null
  right_reps?: number | null
}

export const hasRight = (s: SidedSet): boolean =>
  s.right_reps !== null && s.right_reps !== undefined

/** Each side as weight × reps (one entry unless left and right were logged). */
export function sides(s: SidedSet): { weightKg: number; reps: number }[] {
  const left = { weightKg: Number(s.weight_kg), reps: s.reps }
  if (!hasRight(s)) return [left]
  return [left, { weightKg: Number(s.right_weight_kg ?? s.weight_kg), reps: s.right_reps ?? 0 }]
}

/** Weight × reps actually moved: doubled for two dumbbells, left + right for single-arm moves. */
export function setTonnage(s: SidedSet, mode: LoadMode): number {
  const parts = sides(s).map((x) => Math.max(0, x.weightKg) * Math.max(0, x.reps))
  if (mode === 'per_hand') return parts[0]! * 2
  if (mode === 'per_side' && parts.length === 1) return parts[0]! * 2
  return parts.reduce((a, b) => a + b, 0)
}

/** The stronger side (for PBs and strength trends). */
const score = (x: { weightKg: number; reps: number }) => e1rm(x.weightKg, x.reps) ?? x.reps

export function bestSide(s: SidedSet): { weightKg: number; reps: number } {
  const all = sides(s)
  return all.reduce((a, b) => (score(b) > score(a) ? b : a))
}

/** "each" after the weight for two dumbbells/handles. */
export const eachSuffix = (mode: LoadMode): string => (mode === 'per_hand' ? ' each' : '')
