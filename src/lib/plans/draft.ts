import {
  newPlanRow,
  newScheduleRow,
  instantiateWorkout,
  type Ctx,
  type PlanRows,
} from './instantiate'
import type { TargetLike } from './targets'
import { TEMPLATES, versionTitle, type TemplateSession } from './templates'

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** An exercise the user picked for their own workout, with its starting set targets. */
export interface CustomExercise {
  exerciseId: string
  targets: TargetLike[]
}

/**
 * Where a workout in a plan came from: a preset (e.g. Push A) or the user's own, optionally made
 * under a workout type (e.g. "Custom Push") with the exercises they picked.
 */
export type WorkoutSource =
  | { kind: 'preset'; templateId: string; version: string }
  | { kind: 'custom'; name: string; templateId?: string; exercises?: CustomExercise[] }

export interface DraftItem {
  /** Stable identity of the source, e.g. "preset:push:A" or "custom:arms" */
  key: string
  source: WorkoutSource
  title: string
  emoji: string | null
  /** ISO weekdays, 1 = Monday */
  weekdays: number[]
}

export const sourceKey = (s: WorkoutSource): string =>
  s.kind === 'preset'
    ? `preset:${s.templateId}:${s.version}`
    : `custom:${s.name.trim().toLowerCase()}`

export function presetFor(s: WorkoutSource): TemplateSession | null {
  if (s.kind !== 'preset') return null
  return (
    TEMPLATES.find((t) => t.id === s.templateId)?.sessions.find((v) => v.name === s.version) ?? null
  )
}

export function emojiFor(s: WorkoutSource): string | null {
  if (s.kind === 'preset') return presetFor(s)?.emoji ?? null
  return TEMPLATES.find((t) => t.id === s.templateId)?.sessions[0]?.emoji ?? null
}

/** Custom exercises to copy into the plan (presets bring their own). */
export const customExercisesOf = (s: WorkoutSource): readonly CustomExercise[] =>
  s.kind === 'custom' ? (s.exercises ?? []) : []

/** Swaps in a new version of a workout's source (e.g. exercises changed), keeping its days. */
export function replaceDraftSource(
  draft: readonly DraftItem[],
  oldKey: string,
  source: WorkoutSource,
): DraftItem[] {
  return draft.map((d) =>
    d.key === oldKey ? { ...d, key: sourceKey(source), source, title: titleFor(source) } : d,
  )
}

export function titleFor(s: WorkoutSource): string {
  if (s.kind === 'custom') return s.name.trim()
  const t = TEMPLATES.find((x) => x.id === s.templateId)
  return t ? versionTitle(t.name, s.version) : s.version
}

/**
 * Tap a day for a workout: adds the workout (if new) on that day, or removes the day if it was
 * already chosen. A workout left with no days drops out of the draft.
 */
export function toggleDraftDay(
  draft: readonly DraftItem[],
  source: WorkoutSource,
  weekday: number,
): { draft: DraftItem[]; added: boolean } {
  const key = sourceKey(source)
  const existing = draft.find((d) => d.key === key)
  if (!existing) {
    const item: DraftItem = {
      key,
      source,
      title: titleFor(source),
      emoji: emojiFor(source),
      weekdays: [weekday],
    }
    return { draft: [...draft, item], added: true }
  }
  if (existing.weekdays.includes(weekday)) {
    const weekdays = existing.weekdays.filter((d) => d !== weekday)
    const next = weekdays.length
      ? draft.map((d) => (d.key === key ? { ...d, weekdays } : d))
      : draft.filter((d) => d.key !== key)
    return { draft: next, added: false }
  }
  const weekdays = [...existing.weekdays, weekday].toSorted((a, b) => a - b)
  return { draft: draft.map((d) => (d.key === key ? { ...d, weekdays } : d)), added: true }
}

export interface DayPlan {
  weekday: number
  titles: string[]
}

/** Mon–Sun with what's on each day. */
export function weekOf(
  items: readonly { title: string; weekdays: readonly number[] }[],
): DayPlan[] {
  return DAY_NAMES.map((_, i) => ({
    weekday: i + 1,
    titles: items.filter((it) => it.weekdays.includes(i + 1)).map((it) => it.title),
  }))
}

/** "Mon Push A · Tue Pull A · Thu Push B" (rest days omitted). */
export function weekSummary(
  items: readonly { title: string; weekdays: readonly number[] }[],
): string {
  return weekOf(items)
    .filter((d) => d.titles.length > 0)
    .map((d) => `${DAY_NAMES[d.weekday - 1]} ${d.titles.join(' + ')}`)
    .join(' · ')
}

/** Turns a finished draft into plan rows: one workout per item, scheduled on its days. */
export function buildPlanFromDraft(
  name: string,
  draft: readonly DraftItem[],
  exerciseIdByName: ReadonlyMap<string, string>,
  ctx: Ctx,
): PlanRows & { missing: string[] } {
  const plan = newPlanRow(ctx, name.trim() || 'My plan', 'weekday')
  const rows: PlanRows & { missing: string[] } = {
    plan,
    sessions: [],
    schedule: [],
    exercises: [],
    targets: [],
    missing: [],
  }
  // Order workouts by the first day they fall on
  const ordered = draft.toSorted((a, b) => Math.min(...a.weekdays) - Math.min(...b.weekdays))
  ordered.forEach((item, order) => {
    const w = instantiateWorkout(
      presetFor(item.source),
      plan.id,
      item.title,
      order,
      exerciseIdByName,
      ctx,
      customExercisesOf(item.source),
      item.emoji,
    )
    rows.sessions.push(w.session)
    rows.exercises.push(...w.exercises)
    rows.targets.push(...w.targets)
    rows.missing.push(...w.missing)
    for (const day of item.weekdays)
      rows.schedule.push(newScheduleRow(ctx, plan.id, w.session.id, day))
  })
  return rows
}
