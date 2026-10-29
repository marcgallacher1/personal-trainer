import { describe, expect, it } from 'vitest'
import { EXERCISES } from '../seed/exercises'
import { instantiateTemplate, type Ctx } from './instantiate'
import { buildSnapshot, planRestore, snapshotKey, summariseSnapshot } from './snapshot'
import { TEMPLATES } from './templates'

const names = new Map(EXERCISES.map((e) => [e.name, `id:${e.name}`]))
const ctx = (): Ctx => {
  let n = 0
  return { userId: 'u1', now: '2026-10-31T10:00:00Z', newId: () => `gen-${++n}` }
}

describe('templates', () => {
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

  it('have one suggested template, with no leg days', () => {
    const suggested = TEMPLATES.filter((t) => t.suggested)
    expect(suggested.map((t) => t.id)).toEqual(['upper-focus-4'])
    const legMoves = /squat|deadlift|leg|lunge|calf|hip thrust/i
    for (const s of suggested[0]!.sessions) {
      for (const e of s.exercises) expect(legMoves.test(e.name), e.name).toBe(false)
    }
  })

  it('give weekday templates a weekday for every session', () => {
    for (const t of TEMPLATES.filter((x) => x.scheduleMode === 'weekday')) {
      for (const s of t.sessions) expect(s.weekdays?.length, `${t.id}/${s.name}`).toBeGreaterThan(0)
    }
  })
})

describe('instantiateTemplate', () => {
  const tpl = TEMPLATES.find((t) => t.id === 'upper-focus-4')!

  it('creates sessions, exercises, targets, supersets and alternatives', () => {
    const rows = instantiateTemplate(tpl, names, ctx())
    expect(rows.missing).toEqual([])
    expect(rows.plan.schedule_mode).toBe('rotation')
    expect(rows.sessions.map((s) => s.name)).toEqual(['Push A', 'Pull A', 'Push B', 'Pull B'])
    expect(rows.schedule).toEqual([]) // rotation order comes from session order

    const pushA = rows.exercises.filter((e) => e.plan_session_id === rows.sessions[0]!.id)
    expect(pushA).toHaveLength(7)
    const tri = pushA.filter((e) => e.group_id)
    expect(tri).toHaveLength(2)
    expect(tri[0]!.group_id).toBe(tri[1]!.group_id)
    expect(tri[0]!.group_type).toBe('superset')
    expect(pushA[0]!.alternatives).toEqual([
      'id:Incline Machine Press',
      'id:Smith Machine Incline Press',
    ])

    const incline = rows.targets.filter((t) => t.plan_exercise_id === pushA[0]!.id)
    expect(incline.map((t) => [t.reps_min, t.reps_max, t.target_rir])).toEqual([
      [8, 12, 1],
      [8, 12, 1],
      [8, 12, 1],
    ])
  })

  it('creates weekday schedule rows for weekday templates', () => {
    const ppl = instantiateTemplate(
      TEMPLATES.find((t) => t.id === 'ppl-6')!,
      names,
      ctx(),
    )
    expect(ppl.schedule.map((s) => s.weekday).toSorted()).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('reports unknown exercises instead of failing', () => {
    const rows = instantiateTemplate(tpl, new Map(), ctx())
    expect(rows.exercises).toEqual([])
    expect(rows.missing.length).toBeGreaterThan(0)
  })
})

describe('snapshots', () => {
  const tpl = TEMPLATES.find((t) => t.id === 'upper-focus-4')!

  it('are stable regardless of timestamps and ignore deleted rows', () => {
    const rows = instantiateTemplate(tpl, names, ctx())
    const a = buildSnapshot(rows)
    const touched = {
      ...rows,
      targets: rows.targets.map((t) => ({ ...t, updated_at: '2030-01-01T00:00:00Z' })),
    }
    expect(snapshotKey(buildSnapshot(touched))).toBe(snapshotKey(a))

    const withDeleted = {
      ...rows,
      targets: [...rows.targets, { ...rows.targets[0]!, id: 'x', deleted_at: '2026-01-01' }],
    }
    expect(snapshotKey(buildSnapshot(withDeleted))).toBe(snapshotKey(a))
    expect(summariseSnapshot(a)).toBe('4 sessions · 27 exercises · 76 sets')
  })

  it('plans a restore: upsert snapshot rows, delete rows added since', () => {
    const rows = instantiateTemplate(tpl, names, ctx())
    const snap = buildSnapshot(rows)
    const added = { ...rows.targets[0]!, id: 'new-target' }
    const current = {
      ...rows,
      plan: { ...rows.plan, name: 'Renamed' },
      targets: [...rows.targets, added],
    }
    const r = planRestore(snap, current)
    expect(r.planPatch.name).toBe('Upper focus · 4 days')
    expect(r.deletions.targets.map((t) => t.id)).toEqual(['new-target'])
    expect(r.upserts.targets).toHaveLength(rows.targets.length)
  })
})

describe('snapshotKey', () => {
  it('ignores object key order (Postgres jsonb reorders keys)', () => {
    const rows = instantiateTemplate(TEMPLATES[0]!, names, ctx())
    const snap = buildSnapshot(rows)
    const reversed = JSON.parse(
      JSON.stringify(snap, (_k, v: unknown) =>
        v && typeof v === 'object' && !Array.isArray(v)
          ? Object.fromEntries(Object.entries(v as Record<string, unknown>).toReversed())
          : v,
      ),
    ) as typeof snap
    expect(JSON.stringify(reversed)).not.toBe(JSON.stringify(snap))
    expect(snapshotKey(reversed)).toBe(snapshotKey(snap))
  })
})

describe('snapshotKey timestamps', () => {
  it('ignores created_at formatting differences between server and device', () => {
    const rows = instantiateTemplate(TEMPLATES[0]!, names, ctx())
    const fromServer = {
      ...rows,
      sessions: rows.sessions.map((s) => ({ ...s, created_at: '2026-10-31T10:00:00+00:00' })),
    }
    expect(snapshotKey(buildSnapshot(fromServer))).toBe(snapshotKey(buildSnapshot(rows)))
  })
})
