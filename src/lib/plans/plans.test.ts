import { describe, expect, it } from 'vitest'
import { EXERCISES } from '../seed/exercises'
import {
  buildPlanFromDraft,
  replaceDraftSource,
  sourceKey,
  titleFor,
  toggleDraftDay,
  weekOf,
  weekSummary,
  type DraftItem,
  type WorkoutSource,
} from './draft'
import { instantiateWorkout, type Ctx, type PlanRows } from './instantiate'
import { buildSnapshot, planRestore, snapshotKey, summariseSnapshot } from './snapshot'
import { TEMPLATES } from './templates'

const names = new Map(EXERCISES.map((e) => [e.name, `id:${e.name}`]))
const ctx = (): Ctx => {
  let n = 0
  return { userId: 'u1', now: '2026-10-31T10:00:00Z', newId: () => `gen-${++n}` }
}
const pushA: WorkoutSource = { kind: 'preset', templateId: 'push', version: 'A' }
const pullA: WorkoutSource = { kind: 'preset', templateId: 'pull', version: 'A' }
const arms: WorkoutSource = { kind: 'custom', name: 'Arms' }

/** Mon Push A, Tue Pull A, Thu Push A, Fri Arms */
function sampleDraft(): DraftItem[] {
  let d: DraftItem[] = []
  for (const [src, day] of [
    [pushA, 1],
    [pullA, 2],
    [pushA, 4],
    [arms, 5],
  ] as const) {
    d = toggleDraftDay(d, src, day).draft
  }
  return d
}

describe('presets', () => {
  it('only reference exercises that exist in the catalogue', () => {
    for (const t of TEMPLATES) {
      for (const s of t.sessions) {
        for (const e of s.exercises) {
          expect(names.has(e.name), `${t.id}: ${e.name}`).toBe(true)
          for (const alt of e.alternatives ?? []) {
            expect(names.has(alt), `${t.id}: alt ${alt}`).toBe(true)
          }
        }
      }
    }
  })

  it('name versions A, B… and give each a description', () => {
    for (const t of TEMPLATES) {
      t.sessions.forEach((s, i) => {
        expect(s.name, t.id).toBe(String.fromCharCode(65 + i))
        expect(s.description.length, `${t.id} ${s.name}`).toBeGreaterThan(10)
      })
    }
  })

  it('suggests only upper-body workouts (no leg work)', () => {
    const legMoves = /squat|deadlift|leg|lunge|calf|hip thrust/i
    const suggested = TEMPLATES.filter((t) => t.suggested)
    expect(suggested.map((t) => t.id)).toEqual(['push', 'pull', 'shoulders-arms', 'back-arms'])
    for (const t of suggested) {
      for (const s of t.sessions) {
        for (const e of s.exercises) expect(legMoves.test(e.name), e.name).toBe(false)
      }
    }
  })
})

describe('draft plan', () => {
  it('adds a workout when a day is first picked, and adds further days to it', () => {
    const first = toggleDraftDay([], pushA, 1)
    expect(first.added).toBe(true)
    expect(first.draft).toEqual([
      { key: 'preset:push:A', source: pushA, title: 'Push A', emoji: '💪', weekdays: [1] },
    ])
    const second = toggleDraftDay(first.draft, pushA, 4)
    expect(second.added).toBe(true)
    expect(second.draft[0]!.weekdays).toEqual([1, 4])
  })

  it('removes a day on a second tap, and drops the workout when no days are left', () => {
    let d = toggleDraftDay([], pushA, 1).draft
    d = toggleDraftDay(d, pushA, 4).draft
    const off = toggleDraftDay(d, pushA, 1)
    expect(off.added).toBe(false)
    expect(off.draft[0]!.weekdays).toEqual([4])
    expect(toggleDraftDay(off.draft, pushA, 4).draft).toEqual([])
  })

  it('titles presets and custom workouts', () => {
    expect(titleFor(pushA)).toBe('Push A')
    expect(titleFor({ kind: 'preset', templateId: 'shoulders-arms', version: 'A' })).toBe(
      'Shoulders & arms A',
    )
    expect(titleFor(arms)).toBe('Arms')
    expect(sourceKey({ kind: 'custom', name: ' Arms ' })).toBe('custom:arms')
  })

  it('summarises the week', () => {
    const d = sampleDraft()
    expect(weekSummary(d)).toBe('Mon Push A · Tue Pull A · Thu Push A · Fri Arms')
    expect(weekOf(d).map((x) => x.titles.length)).toEqual([1, 1, 0, 1, 1, 0, 0])
  })

  it('builds plan rows: one workout per item, scheduled on its days', () => {
    const rows = buildPlanFromDraft('My upper plan', sampleDraft(), names, ctx())
    expect(rows.plan.name).toBe('My upper plan')
    expect(rows.plan.is_active).toBe(false)
    expect(rows.sessions.map((s) => s.name)).toEqual(['Push A', 'Pull A', 'Arms'])
    const push = rows.sessions[0]!
    expect(
      rows.schedule.filter((s) => s.plan_session_id === push.id).map((s) => s.weekday),
    ).toEqual([1, 4])
    expect(rows.exercises.filter((e) => e.plan_session_id === push.id)).toHaveLength(7)
    // Custom workouts start empty, ready to fill in
    expect(rows.exercises.filter((e) => e.plan_session_id === rows.sessions[2]!.id)).toEqual([])
    expect(rows.missing).toEqual([])
  })
})

describe('custom workouts with chosen exercises', () => {
  const set = {
    set_type: 'working',
    reps_min: 8,
    reps_max: 12,
    seconds_min: null,
    seconds_max: null,
    target_rir: 1,
  }
  const myPush: WorkoutSource = {
    kind: 'custom',
    name: 'Custom Push',
    templateId: 'push',
    exercises: [
      { exerciseId: 'ex-incline', targets: [set, set, set] },
      { exerciseId: 'ex-dips', targets: [set, set] },
    ],
  }

  it('copies the chosen exercises and their targets into the plan, in order', () => {
    const draft = toggleDraftDay([], myPush, 3).draft
    expect(draft[0]!.emoji).toBe(TEMPLATES.find((t) => t.id === 'push')!.sessions[0]!.emoji)
    const rows = buildPlanFromDraft('Mine', draft, names, ctx())
    expect(rows.sessions.map((s) => s.name)).toEqual(['Custom Push'])
    expect(rows.exercises.map((e) => [e.exercise_id, e.order])).toEqual([
      ['ex-incline', 0],
      ['ex-dips', 1],
    ])
    expect(rows.targets).toHaveLength(5)
    expect(rows.schedule.map((d) => d.weekday)).toEqual([3])
  })

  it('updates a workout already on a day when its exercises or name change', () => {
    const draft = toggleDraftDay([], myPush, 3).draft
    const renamed: WorkoutSource = { ...myPush, name: 'Big Push', exercises: [] }
    const next = replaceDraftSource(draft, sourceKey(myPush), renamed)
    expect(next).toEqual([
      expect.objectContaining({ key: 'custom:big push', title: 'Big Push', weekdays: [3] }),
    ])
    expect(replaceDraftSource(draft, 'custom:nope', renamed)).toEqual(draft)
  })
})

describe('instantiateWorkout', () => {
  it('copies a preset with targets, supersets and alternatives', () => {
    const preset = TEMPLATES.find((t) => t.id === 'push')!.sessions[0]!
    const w = instantiateWorkout(preset, 'plan-1', 'Push A', 0, names, ctx())
    expect(w.session.name).toBe('Push A')
    expect(w.session.notes).toMatch(/Chest, shoulders & triceps/)
    const tri = w.exercises.filter((e) => e.group_id)
    expect(tri).toHaveLength(2)
    expect(tri[0]!.group_id).toBe(tri[1]!.group_id)
    expect(w.exercises[0]!.alternatives).toEqual([
      'id:Incline Machine Press',
      'id:Smith Machine Incline Press',
    ])
    expect(w.targets.filter((t) => t.plan_exercise_id === w.exercises[0]!.id)).toHaveLength(3)
  })

  it('reports unknown exercises instead of failing', () => {
    const preset = TEMPLATES.find((t) => t.id === 'push')!.sessions[0]!
    const w = instantiateWorkout(preset, 'plan-1', 'Push A', 0, new Map(), ctx())
    expect(w.exercises).toEqual([])
    expect(w.missing.length).toBeGreaterThan(0)
  })
})

const rows = (): PlanRows => buildPlanFromDraft('Plan', sampleDraft(), names, ctx())

describe('snapshots', () => {
  it('are stable regardless of timestamps and ignore deleted rows', () => {
    const r = rows()
    const a = buildSnapshot(r)
    const touched = {
      ...r,
      targets: r.targets.map((t) => ({ ...t, updated_at: '2030-01-01T00:00:00Z' })),
    }
    expect(snapshotKey(buildSnapshot(touched))).toBe(snapshotKey(a))
    const withDeleted = {
      ...r,
      targets: [...r.targets, { ...r.targets[0]!, id: 'x', deleted_at: '2026-01-01' }],
    }
    expect(snapshotKey(buildSnapshot(withDeleted))).toBe(snapshotKey(a))
    // Push A 20 sets + Pull A 19 sets + Arms 0
    expect(summariseSnapshot(a)).toBe('3 sessions · 14 exercises · 39 sets')
  })

  it('plans a restore: upsert snapshot rows, delete rows added since', () => {
    const r = rows()
    const snap = buildSnapshot(r)
    const current = {
      ...r,
      plan: { ...r.plan, name: 'Renamed' },
      targets: [...r.targets, { ...r.targets[0]!, id: 'new-target' }],
    }
    const restore = planRestore(snap, current)
    expect(restore.planPatch.name).toBe('Plan')
    expect(restore.deletions.targets.map((t) => t.id)).toEqual(['new-target'])
  })

  it('ignore object key order and created_at formatting (server vs device)', () => {
    const r = rows()
    const snap = buildSnapshot(r)
    const reversed = JSON.parse(
      JSON.stringify(snap, (_k, v: unknown) =>
        v && typeof v === 'object' && !Array.isArray(v)
          ? Object.fromEntries(Object.entries(v as Record<string, unknown>).toReversed())
          : v,
      ),
    ) as typeof snap
    expect(snapshotKey(reversed)).toBe(snapshotKey(snap))
    const fromServer = {
      ...r,
      sessions: r.sessions.map((s) => ({ ...s, created_at: '2026-10-31T10:00:00+00:00' })),
    }
    expect(snapshotKey(buildSnapshot(fromServer))).toBe(snapshotKey(snap))
  })
})
