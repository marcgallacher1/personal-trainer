import { formatSeconds } from '../logging/pr'
import { isTimed, type LogType, type SetType } from '../logging/types'

/** The fields of a plan set target the pure helpers need. */
export interface TargetLike {
  set_type: string
  reps_min: number | null
  reps_max: number | null
  seconds_min: number | null
  seconds_max: number | null
  target_rir: number | null
}

const range = (min: number | null, max: number | null): string | null => {
  if (min === null && max === null) return null
  if (min === null || max === null || min === max) return `${min ?? max}`
  return `${min}–${max}`
}

const timeRange = (min: number | null, max: number | null): string | null => {
  if (min === null && max === null) return null
  if (min === null || max === null || min === max) return formatSeconds((min ?? max)!)
  return `${formatSeconds(min)}–${formatSeconds(max)}`
}

/** "8–12 reps · RIR 1", "Warm-up · 10 reps", "30–45 s", "To failure". */
export function describeTarget(t: TargetLike, logType: LogType): string {
  const parts: string[] = []
  if (t.set_type === 'warmup') parts.push('Warm-up')
  if (t.set_type === 'drop') parts.push('Drop set')
  if (isTimed(logType)) {
    const r = timeRange(t.seconds_min, t.seconds_max)
    if (r) parts.push(r)
  } else {
    const r = range(t.reps_min, t.reps_max)
    if (r) parts.push(`${r} reps`)
  }
  if (t.set_type !== 'warmup') {
    if (t.set_type === 'failure' || t.target_rir === 0) parts.push('to failure')
    else if (t.target_rir !== null) parts.push(`RIR ${t.target_rir}`)
  }
  return parts.join(' · ') || 'Any'
}

/** Compact whole-exercise summary: "3 × 8–12 · RIR 1", "1 warm-up + 3 × 10–15 · to failure". */
export function describeTargets(targets: readonly TargetLike[], logType: LogType): string {
  if (targets.length === 0) return 'No sets planned'
  const warmups = targets.filter((t) => t.set_type === 'warmup').length
  const work = targets.filter((t) => t.set_type !== 'warmup')

  // Group consecutive identical working targets: "1 × 6–8, 2 × 10–12"
  const groups: { count: number; label: string }[] = []
  for (const t of work) {
    const label = describeTarget(t, logType)
    const last = groups.at(-1)
    if (last && last.label === label) last.count++
    else groups.push({ count: 1, label })
  }
  const body = groups.map((g) => `${g.count} × ${g.label}`).join(', ')
  return warmups > 0 ? `${warmups} warm-up${warmups > 1 ? 's' : ''} + ${body}` : body
}

export interface QuickSetsInput {
  sets: number
  min: number
  max: number
  rir: number | null
}

/** Working-set targets for "3 × 8–12 @ RIR 1" (reps, or seconds for timed exercises). */
export function quickSets(input: QuickSetsInput, logType: LogType): TargetLike[] {
  const timed = isTimed(logType)
  return Array.from({ length: Math.max(0, input.sets) }, () => ({
    set_type: 'working' as SetType,
    reps_min: timed ? null : input.min,
    reps_max: timed ? null : input.max,
    seconds_min: timed ? input.min : null,
    seconds_max: timed ? input.max : null,
    target_rir: input.rir,
  }))
}
