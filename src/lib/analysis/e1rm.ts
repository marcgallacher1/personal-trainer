/** Epley is unreliable for high-rep sets, so e1RM is only estimated for 1–12 reps. */
export const E1RM_MAX_REPS = 12

/** Estimated one-rep max (Epley: w × (1 + reps/30)). Returns null when it can't be estimated. */
export function e1rm(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps < 1 || reps > E1RM_MAX_REPS) return null
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

/** Weight × reps. */
export function volumeLoad(weightKg: number, reps: number): number {
  return Math.max(0, weightKg) * Math.max(0, reps)
}
