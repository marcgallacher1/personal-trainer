import { e1rm } from '../analysis/e1rm'
import { formatSeconds } from './pr'
import type { LoadMode, LogType } from './types'

export const LOG_TYPE_INFO: Record<LogType, { name: string; description: string }> = {
  weight_reps: { name: 'Weight × reps', description: 'e.g. bench press, curls' },
  bodyweight_reps: {
    name: 'Bodyweight × reps',
    description: 'Optional added weight, e.g. dips, ab wheel',
  },
  assisted_reps: {
    name: 'Assisted',
    description: 'Machine assistance — less is harder',
  },
  duration: { name: 'Timed hold', description: 'Optional added weight, e.g. plank' },
  weight_duration: { name: 'Weight × time', description: "e.g. farmer's walk" },
}

const n = (x: number) => `${Math.round(x * 100) / 100}`

interface SetLike {
  weight_kg: number
  reps: number
  duration_seconds: number | null
  right_weight_kg?: number | null
  right_reps?: number | null
}

const hasRight = (s: SetLike) => s.right_reps !== null && s.right_reps !== undefined

/** The "load" column: what you lifted / added / were assisted by. */
export function formatLoad(s: SetLike, t: LogType, mode: LoadMode = 'total'): string {
  switch (t) {
    case 'weight_reps':
    case 'weight_duration': {
      if (hasRight(s) && Number(s.right_weight_kg ?? s.weight_kg) !== Number(s.weight_kg))
        return `${n(s.weight_kg)} / ${n(Number(s.right_weight_kg))} kg`
      return `${n(s.weight_kg)} kg${mode === 'per_hand' ? ' each' : ''}`
    }
    case 'bodyweight_reps':
    case 'duration':
      return s.weight_kg > 0 ? `BW +${n(s.weight_kg)} kg` : 'BW'
    case 'assisted_reps':
      return `${n(s.weight_kg)} kg assist`
  }
}

/** The "effort" column: reps or time. */
export function formatEffort(s: SetLike, t: LogType): string {
  if (t === 'duration' || t === 'weight_duration') return formatSeconds(s.duration_seconds ?? 0)
  return hasRight(s) ? `L${s.reps} R${s.right_reps}` : `${s.reps}`
}

/** One set as text, e.g. "80 kg × 8" or "45 s". */
export function formatSet(s: SetLike, t: LogType, mode: LoadMode = 'total'): string {
  if (t === 'duration') {
    return s.weight_kg > 0
      ? `${formatSeconds(s.duration_seconds ?? 0)} (+${n(s.weight_kg)} kg)`
      : formatSeconds(s.duration_seconds ?? 0)
  }
  return `${formatLoad(s, t, mode)} × ${formatEffort(s, t)}`
}

/** Column headings for the logged-sets table. */
export function columnHeadings(t: LogType): { load: string; effort: string } {
  switch (t) {
    case 'weight_reps':
      return { load: 'Weight', effort: 'Reps' }
    case 'bodyweight_reps':
      return { load: 'Load', effort: 'Reps' }
    case 'assisted_reps':
      return { load: 'Assist', effort: 'Reps' }
    case 'duration':
      return { load: 'Load', effort: 'Time' }
    case 'weight_duration':
      return { load: 'Weight', effort: 'Time' }
  }
}

export function asLogType(value: string | null | undefined): LogType {
  return value === 'bodyweight_reps' ||
    value === 'assisted_reps' ||
    value === 'duration' ||
    value === 'weight_duration'
    ? value
    : 'weight_reps'
}

function maxBy<T>(xs: readonly T[], f: (x: T) => number): T | undefined {
  return xs.reduce<T | undefined>(
    (best, x) => (best === undefined || f(x) > f(best) ? x : best),
    undefined,
  )
}

export interface StatTile {
  label: string
  value: string
  detail?: string
}

/** Headline stats for an exercise's history (working sets only), adapted to how it's logged. */
export function headlineStats(
  sets: readonly (SetLike & { set_type: string })[],
  t: LogType,
): StatTile[] {
  const work = sets.filter((s) => s.set_type !== 'warmup')
  const dash = '—'

  switch (t) {
    case 'weight_reps': {
      const best = maxBy(
        work.filter((s) => e1rm(s.weight_kg, s.reps) !== null),
        (s) => e1rm(s.weight_kg, s.reps)!,
      )
      const heaviest = maxBy(work, (s) => s.weight_kg)
      return [
        {
          label: 'Est. 1-rep max (kg)',
          value: best ? n1(e1rm(best.weight_kg, best.reps)!) : dash,
          detail: best ? formatSet(best, t) : undefined,
        },
        { label: 'Heaviest (kg)', value: heaviest?.weight_kg ? n1(heaviest.weight_kg) : dash },
      ]
    }
    case 'bodyweight_reps': {
      const most = maxBy(work, (s) => s.reps)
      const heaviest = maxBy(work, (s) => s.weight_kg)
      return [
        {
          label: 'Most reps',
          value: most ? `${most.reps}` : dash,
          detail: most ? formatSet(most, t) : undefined,
        },
        {
          label: 'Heaviest added (kg)',
          value: heaviest?.weight_kg ? n1(heaviest.weight_kg) : dash,
        },
      ]
    }
    case 'assisted_reps': {
      const most = maxBy(work, (s) => s.reps)
      const least = maxBy(work, (s) => -s.weight_kg)
      return [
        {
          label: 'Most reps',
          value: most ? `${most.reps}` : dash,
          detail: most ? formatSet(most, t) : undefined,
        },
        { label: 'Least assistance (kg)', value: least ? n1(least.weight_kg) : dash },
      ]
    }
    case 'duration': {
      const longest = maxBy(work, (s) => s.duration_seconds ?? 0)
      const heaviest = maxBy(work, (s) => s.weight_kg)
      return [
        {
          label: 'Longest hold',
          value: longest ? formatSeconds(longest.duration_seconds ?? 0) : dash,
        },
        {
          label: 'Heaviest added (kg)',
          value: heaviest?.weight_kg ? n1(heaviest.weight_kg) : dash,
        },
      ]
    }
    case 'weight_duration': {
      const heaviest = maxBy(work, (s) => s.weight_kg)
      const longest = maxBy(work, (s) => s.duration_seconds ?? 0)
      return [
        { label: 'Heaviest (kg)', value: heaviest ? n1(heaviest.weight_kg) : dash },
        {
          label: 'Longest',
          value: longest ? formatSeconds(longest.duration_seconds ?? 0) : dash,
          detail: longest ? formatSet(longest, t) : undefined,
        },
      ]
    }
  }
}

const n1 = (x: number) => `${Math.round(x * 10) / 10}`
