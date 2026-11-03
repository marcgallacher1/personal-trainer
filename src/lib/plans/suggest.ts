/**
 * Which plan workout to do today: not done yet this week, muscles rested, missed ones first,
 * then what's scheduled for today.
 */
import { addDays, isWorking, weekdayOf, weekOf, type ExerciseInfo } from '../analysis/training'

export interface SuggestWorkout {
  id: string
  name: string
  /** ISO weekdays it's on (empty = any day) */
  days: readonly number[]
  exerciseIds: readonly string[]
}

export interface SuggestSession {
  date: string
  /** Plan workout it was started from */
  workoutId: string | null
  sets: readonly { exerciseId: string; setType: string }[]
}

export interface Suggestion {
  workoutId: string
  /** Short reason, e.g. "Missed on Tue · chest worked yesterday" */
  why: string
}

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
/** Muscles trained this recently still count as tired (48 h, the usual recovery window) */
const REST_DAYS = 2
/** A muscle needs this many recent sets to count as tired */
const TIRED_SETS = 4

/** Main muscles a workout trains, by how many exercises hit them. */
function musclesOf(ids: readonly string[], info: ReadonlyMap<string, ExerciseInfo>) {
  const out = new Map<string, number>()
  for (const id of ids) {
    for (const m of info.get(id)?.muscles ?? []) {
      if (m.weight >= 1) out.set(m.muscleId, (out.get(m.muscleId) ?? 0) + 1)
    }
  }
  return out
}

export function suggestWorkout(input: {
  today: string
  workouts: readonly SuggestWorkout[]
  sessions: readonly SuggestSession[]
  info: ReadonlyMap<string, ExerciseInfo>
  muscleName: (id: string) => string
}): Suggestion | null {
  const { today, workouts, sessions, info } = input
  const monday = weekOf(today)
  const day = weekdayOf(today)

  // Sets per main muscle over the last 2 days (today included)
  const tired = new Map<string, number>()
  for (const s of sessions) {
    if (s.date < addDays(today, -REST_DAYS + 1) || s.date > today) continue
    for (const x of s.sets) {
      if (!isWorking(x)) continue
      for (const m of info.get(x.exerciseId)?.muscles ?? []) {
        if (m.weight >= 1) tired.set(m.muscleId, (tired.get(m.muscleId) ?? 0) + 1)
      }
    }
  }
  const isTired = (m: string) => (tired.get(m) ?? 0) >= TIRED_SETS

  const done = new Map<string, number>()
  for (const s of sessions) {
    if (s.workoutId && s.date >= monday && s.date <= today)
      done.set(s.workoutId, (done.get(s.workoutId) ?? 0) + 1)
  }

  let best: { w: SuggestWorkout; score: number; why: string[] } | null = null
  for (const w of workouts) {
    const times = Math.max(1, w.days.length)
    const left = times - (done.get(w.id) ?? 0)
    if (left <= 0) continue

    const muscles = musclesOf(w.exerciseIds, info)
    const total = [...muscles.values()].reduce((a, b) => a + b, 0)
    const overlap = [...muscles].filter(([m]) => isTired(m))
    const tiredShare = total ? overlap.reduce((a, [, n]) => a + n, 0) / total : 0
    const missed = w.days.filter((d) => d < day).length - (done.get(w.id) ?? 0) > 0
    const scheduledToday = w.days.includes(day)
    const later = w.days.filter((d) => d > day)

    let score = -60 * tiredShare
    const why: string[] = []
    if (missed) {
      score += 40
      why.push(`Missed on ${DAY[w.days.find((d) => d < day)! - 1]}`)
    }
    if (scheduledToday) {
      score += 30
      if (!missed) why.push('Planned for today')
    } else if (!missed && later.length) {
      score -= 5 * (Math.min(...later) - day)
    }
    if (tiredShare === 0 && tired.size) why.push('muscles rested')
    if (!best || score > best.score) best = { w, score, why }
  }
  if (!best) return null

  // Say why if it isn't what's on the calendar today
  const planned = workouts.find((w) => w.days.includes(day))
  const reasons = [...best.why]
  if (planned && planned.id !== best.w.id && (done.get(planned.id) ?? 0) < 1) {
    const sore = [...musclesOf(planned.exerciseIds, info).keys()].filter(isTired)
    if (sore.length)
      reasons.push(
        `${sore.slice(0, 2).map(input.muscleName).join(' and ').toLowerCase()} worked recently`,
      )
  }
  const why = reasons.join(' · ')
  return {
    workoutId: best.w.id,
    why: why ? why[0]!.toUpperCase() + why.slice(1) : 'Next in your plan',
  }
}
