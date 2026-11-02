import type { Tables } from '../../db/database.types'
import type { TemplateSession } from './templates'
import type { TargetLike } from './targets'

export type PlanRow = Tables<'plans'>
export type PlanSessionRow = Tables<'plan_sessions'>
export type PlanScheduleRow = Tables<'plan_schedule'>
export type PlanExerciseRow = Tables<'plan_exercises'>
export type PlanSetTargetRow = Tables<'plan_set_targets'>

export interface PlanRows {
  plan: PlanRow
  sessions: PlanSessionRow[]
  schedule: PlanScheduleRow[]
  exercises: PlanExerciseRow[]
  targets: PlanSetTargetRow[]
}

export interface Ctx {
  userId: string
  now: string
  newId: () => string
}

const meta = (ctx: Ctx) => ({
  user_id: ctx.userId,
  created_at: ctx.now,
  updated_at: ctx.now,
  deleted_at: null,
})

export function newPlanRow(ctx: Ctx, name: string, scheduleMode: 'rotation' | 'weekday'): PlanRow {
  return {
    ...meta(ctx),
    id: ctx.newId(),
    name,
    goal: null,
    notes: null,
    is_active: false,
    schedule_mode: scheduleMode,
    block_weeks: null,
    deload_week: null,
    block_start_date: null,
    rotation_anchor_date: null,
    current_version: 1,
    archived: false,
  }
}

export function newSessionRow(
  ctx: Ctx,
  planId: string,
  name: string,
  order: number,
  emoji: string | null = null,
): PlanSessionRow {
  return {
    ...meta(ctx),
    id: ctx.newId(),
    plan_id: planId,
    name,
    colour: null,
    emoji,
    notes: null,
    warmup_notes: null,
    est_minutes: null,
    order,
  }
}

export function newPlanExerciseRow(
  ctx: Ctx,
  planSessionId: string,
  exerciseId: string,
  order: number,
): PlanExerciseRow {
  return {
    ...meta(ctx),
    id: ctx.newId(),
    plan_session_id: planSessionId,
    exercise_id: exerciseId,
    order,
    group_id: null,
    group_type: null,
    rest_seconds: null,
    tempo: null,
    notes: null,
    progression_rule: 'double',
    progression_config: {},
    alternatives: [],
  }
}

export function newTargetRow(
  ctx: Ctx,
  planExerciseId: string,
  order: number,
  t: Pick<
    PlanSetTargetRow,
    'set_type' | 'reps_min' | 'reps_max' | 'seconds_min' | 'seconds_max' | 'target_rir'
  >,
): PlanSetTargetRow {
  return {
    ...meta(ctx),
    id: ctx.newId(),
    plan_exercise_id: planExerciseId,
    order,
    set_type: t.set_type,
    reps_min: t.reps_min,
    reps_max: t.reps_max,
    seconds_min: t.seconds_min,
    seconds_max: t.seconds_max,
    weight_kg: null,
    pct_e1rm: null,
    target_rir: t.target_rir,
    target_rpe: null,
  }
}

export function newScheduleRow(
  ctx: Ctx,
  planId: string,
  sessionId: string,
  weekday: number,
): PlanScheduleRow {
  return {
    ...meta(ctx),
    id: ctx.newId(),
    plan_id: planId,
    plan_session_id: sessionId,
    weekday,
    rotation_index: null,
    planned_time: null,
    tz: 'Europe/London',
    week_of_block: null,
  }
}

export interface WorkoutRows {
  session: PlanSessionRow
  exercises: PlanExerciseRow[]
  targets: PlanSetTargetRow[]
  /** Template exercise names not found in the catalogue (skipped) */
  missing: string[]
}

/** Copies a preset (or your own workout) into a plan. Unknown exercises are skipped and listed. */
export function instantiateWorkout(
  preset: TemplateSession | null,
  planId: string,
  title: string,
  order: number,
  exerciseIdByName: ReadonlyMap<string, string>,
  ctx: Ctx,
  custom: readonly { exerciseId: string; targets: readonly TargetLike[] }[] = [],
  emoji: string | null = null,
): WorkoutRows {
  const session = newSessionRow(ctx, planId, title, order, preset?.emoji ?? emoji)
  session.notes = preset?.description ?? null
  const out: WorkoutRows = { session, exercises: [], targets: [], missing: [] }
  if (!preset) {
    custom.forEach((ce, n) => {
      const pe = newPlanExerciseRow(ctx, session.id, ce.exerciseId, n)
      out.exercises.push(pe)
      ce.targets.forEach((t, i) => out.targets.push(newTargetRow(ctx, pe.id, i, t)))
    })
    return out
  }

  const groupIds = new Map<string, string>()
  const groupSizes = new Map<string, number>()
  for (const te of preset.exercises) {
    if (te.superset) groupSizes.set(te.superset, (groupSizes.get(te.superset) ?? 0) + 1)
  }

  let n = 0
  for (const te of preset.exercises) {
    const exerciseId = exerciseIdByName.get(te.name)
    if (!exerciseId) {
      out.missing.push(te.name)
      continue
    }
    const pe = newPlanExerciseRow(ctx, session.id, exerciseId, n++)
    if (te.superset) {
      if (!groupIds.has(te.superset)) groupIds.set(te.superset, ctx.newId())
      pe.group_id = groupIds.get(te.superset)!
      pe.group_type = (groupSizes.get(te.superset) ?? 0) >= 3 ? 'giant' : 'superset'
    }
    pe.alternatives = (te.alternatives ?? [])
      .map((name) => exerciseIdByName.get(name))
      .filter((id): id is string => Boolean(id))
    out.exercises.push(pe)

    for (let i = 0; i < te.sets; i++) {
      out.targets.push(
        newTargetRow(ctx, pe.id, i, {
          set_type: 'working',
          reps_min: te.min,
          reps_max: te.max,
          seconds_min: null,
          seconds_max: null,
          target_rir: te.rir,
        }),
      )
    }
  }
  return out
}
