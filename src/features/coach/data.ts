import { useLiveQuery } from 'dexie-react-hooks'
import type { Tables } from '../../db/database.types'
import { db } from '../../db/local'
import { requireUserId } from '../../db/user'
import { newId, nowIso, save, saveOne } from '../../db/write'
import {
  buildProposals,
  type Proposal,
  type ProposalAction,
  type ProposalOption,
} from '../../lib/adaptive/proposals'
import { planWorkouts } from '../../lib/rating/inputs'
import { londonDate } from '../log/format'
import { snapshotIfChanged } from '../plans/data'
import { applyFix, rateSavedPlan } from '../plans/rating'
import { useTrainingData } from '../progress/data'

export type PlanChange = Tables<'plan_changes'>

const live = (r: { deleted_at: string | null }) => r.deleted_at === null

/** What's stored in plan_changes.diff_json for a coach decision. */
export interface Decision {
  key: string
  option?: string
  action?: ProposalAction
}

const decisionOf = (c: PlanChange): Decision | null => {
  const d = c.diff_json as unknown as Partial<Decision> | null
  return d && typeof d.key === 'string' ? (d as Decision) : null
}

export function usePlanChanges(): PlanChange[] | undefined {
  return useLiveQuery(async () => (await db.plan_changes.toArray()).filter(live), [])
}

/** Suggestions waiting for an answer, most important first. */
export function useProposals(): { planId: string; proposals: Proposal[] } | null | undefined {
  const data = useTrainingData()
  const changes = usePlanChanges()
  if (!data || !changes) return undefined
  if (!data.active) return null
  const decided = new Set(
    changes.flatMap((c) => {
      const d = decisionOf(c)
      return d ? [d.key] : []
    }),
  )
  const plan = data.active
  return {
    planId: plan.plan.id,
    proposals: buildProposals({
      today: data.today,
      sessions: data.sessions,
      ctx: data.ctx,
      plan: {
        id: plan.plan.id,
        workouts: planWorkouts({ ...plan, sessions: plan.versions }),
        since: data.planSince ?? data.today,
        rating: rateSavedPlan(plan, data.ctx),
      },
      decided,
    }),
  }
}

async function record(
  planId: string,
  p: Proposal,
  status: 'accepted' | 'rejected' | 'applied',
  summary: string,
  option?: ProposalOption,
): Promise<void> {
  const now = nowIso()
  const decision: Decision = { key: p.key, option: option?.id, action: option?.action }
  await saveOne('plan_changes', {
    id: newId(),
    user_id: requireUserId(),
    plan_id: planId,
    kind: p.kind,
    proposed_at: now,
    resolved_at: now,
    status,
    summary,
    diff_json: decision,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  })
}

/** Applies the chosen option. Plan edits are saved as a new plan version (the changelog). */
export async function acceptProposal(
  planId: string,
  p: Proposal,
  option: ProposalOption,
): Promise<string> {
  const a = option.action
  const note = `Coach: ${option.label}`
  let status: 'accepted' | 'applied' = 'applied'
  if (a.kind === 'fix') {
    await applyFix(planId, a.fix, note)
  } else if (a.kind === 'swap') {
    const pe = await db.plan_exercises.get(a.planExerciseId)
    if (!pe || pe.deleted_at) throw new Error('That exercise is no longer in the plan')
    const alternatives = [...new Set([pe.exercise_id, ...pe.alternatives])].filter(
      (id) => id !== a.exerciseId,
    )
    await saveOne('plan_exercises', { ...pe, exercise_id: a.exerciseId, alternatives })
    await snapshotIfChanged(planId, note)
  } else if (a.kind === 'reps') {
    const targets = (
      await db.plan_set_targets.where('plan_exercise_id').equals(a.planExerciseId).toArray()
    ).filter((t) => live(t) && t.set_type !== 'warmup')
    await save(
      targets.map((t) => ({
        table: 'plan_set_targets' as const,
        row: { ...t, reps_min: a.repsMin, reps_max: a.repsMax },
      })),
    )
    await snapshotIfChanged(planId, note)
  } else {
    // Resets, moves and folds don't edit the plan; they're used when you next train
    status = 'accepted'
  }
  await record(planId, p, status, `${p.title}: ${option.label}`, option)
  return option.label
}

export async function declineProposal(planId: string, p: Proposal): Promise<void> {
  await record(planId, p, 'rejected', `${p.title}: not now`)
}

/** Accepted decisions of one kind, newest first. */
function accepted<K extends ProposalAction['kind']>(
  changes: readonly PlanChange[],
  kind: K,
): { change: PlanChange; action: Extract<ProposalAction, { kind: K }> }[] {
  return changes
    .filter((c) => c.status === 'accepted')
    .flatMap((c) => {
      const a = decisionOf(c)?.action
      return a?.kind === kind
        ? [{ change: c, action: a as Extract<ProposalAction, { kind: K }> }]
        : []
    })
    .toSorted((x, y) => (y.change.resolved_at ?? '').localeCompare(x.change.resolved_at ?? ''))
}

/** A reset weight accepted after the lift was last done. */
export function resetFor(
  changes: readonly PlanChange[] | undefined,
  exerciseId: string,
  lastDoneAt: string | null,
): number | null {
  const r = accepted(changes ?? [], 'reset').find((x) => x.action.exerciseId === exerciseId)
  if (!r || (lastDoneAt && (r.change.resolved_at ?? '') < lastDoneAt)) return null
  return r.action.weightKg
}

export interface TodayExtras {
  /** Missed workouts moved to today */
  moved: { change: PlanChange; workoutId: string }[]
  /** Lifts to add when starting a workout today: workoutId → exercise ids */
  folds: {
    change: PlanChange
    intoWorkoutId: string
    fromWorkoutId: string
    exerciseIds: string[]
  }[]
}

export function todayExtras(
  changes: readonly PlanChange[] | undefined,
  now = new Date(),
): TodayExtras {
  const today = londonDate(now.toISOString())
  return {
    moved: accepted(changes ?? [], 'reschedule')
      .filter((x) => x.action.date === today)
      .map((x) => ({ change: x.change, workoutId: x.action.workoutId })),
    folds: accepted(changes ?? [], 'fold')
      .filter((x) => x.action.date === today)
      .map((x) => ({
        change: x.change,
        intoWorkoutId: x.action.intoWorkoutId,
        fromWorkoutId: x.action.workoutId,
        exerciseIds: x.action.exerciseIds,
      })),
  }
}

/** Marks a move or fold as done once its workout is started. */
export async function markApplied(change: PlanChange): Promise<void> {
  await saveOne('plan_changes', { ...change, status: 'applied' })
}
