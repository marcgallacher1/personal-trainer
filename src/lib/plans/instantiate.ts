import type { Tables } from '../../db/database.types'
import type { PlanTemplate } from './templates'

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

/** Copies a template into fresh plan rows. Unknown exercise names are skipped (reported back). */
export function instantiateTemplate(
  template: PlanTemplate,
  exerciseIdByName: ReadonlyMap<string, string>,
  ctx: Ctx,
): PlanRows & { missing: string[] } {
  const plan = newPlanRow(ctx, template.name, template.scheduleMode)
  const rows: PlanRows & { missing: string[] } = {
    plan,
    sessions: [],
    schedule: [],
    exercises: [],
    targets: [],
    missing: [],
  }

  template.sessions.forEach((ts, sIdx) => {
    const session = newSessionRow(ctx, plan.id, ts.name, sIdx, ts.emoji)
    session.notes = ts.description
    rows.sessions.push(session)

    for (const weekday of ts.weekdays ?? []) {
      rows.schedule.push({
        ...meta(ctx),
        id: ctx.newId(),
        plan_id: plan.id,
        plan_session_id: session.id,
        weekday,
        rotation_index: null,
        planned_time: null,
        tz: 'Europe/London',
        week_of_block: null,
      })
    }

    const groupIds = new Map<string, string>()
    const groupSizes = new Map<string, number>()
    for (const te of ts.exercises) {
      if (te.superset) groupSizes.set(te.superset, (groupSizes.get(te.superset) ?? 0) + 1)
    }

    let order = 0
    for (const te of ts.exercises) {
      const exerciseId = exerciseIdByName.get(te.name)
      if (!exerciseId) {
        rows.missing.push(te.name)
        continue
      }
      const pe = newPlanExerciseRow(ctx, session.id, exerciseId, order++)
      if (te.superset) {
        if (!groupIds.has(te.superset)) groupIds.set(te.superset, ctx.newId())
        pe.group_id = groupIds.get(te.superset)!
        pe.group_type = (groupSizes.get(te.superset) ?? 0) >= 3 ? 'giant' : 'superset'
      }
      pe.alternatives = (te.alternatives ?? [])
        .map((n) => exerciseIdByName.get(n))
        .filter((id): id is string => Boolean(id))
      rows.exercises.push(pe)

      for (let i = 0; i < te.sets; i++) {
        rows.targets.push(
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
  })

  return rows
}
