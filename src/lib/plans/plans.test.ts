import { describe, expect, it } from 'vitest'
import { EXERCISES } from '../seed/exercises'
import { instantiateTemplate, type Ctx } from './instantiate'
import { buildSnapshot, planRestore, snapshotKey, summariseSnapshot } from './snapshot'
import { nextVersionName, splitByCategory, TEMPLATES, versionTitle } from './templates'

const names = new Map(EXERCISES.map((e) => [e.name, `id:${e.name}`]))
const ctx = (): Ctx => {
  let n = 0
  return { userId: 'u1', now: '2026-10-31T10:00:00Z', newId: () => `gen-${++n}` }
}
const push = TEMPLATES.find((t) => t.id === 'push')!

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

  it('name versions A, B… and give each a description', () => {
    for (const t of TEMPLATES) {
      t.sessions.forEach((s, i) => {
        expect(s.name, t.id).toBe(String.fromCharCode(65 + i))
        expect(s.description.length, `${t.id} ${s.name}`).toBeGreaterThan(10)
      })
    }
  })

  it('suggests only upper-body plans (no leg work)', () => {
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

describe('versions', () => {
  it('picks the next free letter', () => {
    expect(nextVersionName([])).toBe('A')
    expect(nextVersionName(['A', 'B'])).toBe('C')
    expect(nextVersionName(['A', 'C'])).toBe('B')
    expect(versionTitle('Push', 'A')).toBe('Push A')
  })

  it('splits "Push A / Pull A / Push B" into one plan per type', () => {
    const groups = splitByCategory([
      { id: '1', name: 'Push A', order: 0 },
      { id: '2', name: 'Pull A', order: 1 },
      { id: '3', name: 'Push B', order: 2 },
      { id: '4', name: 'Pull B', order: 3 },
      { id: '5', name: 'Legs', order: 4 },
      { id: '6', name: 'Shoulders & arms', order: 5 },
      { id: '7', name: 'Legs', order: 6 },
    ])
    expect(groups).toEqual([
      {
        category: 'Push',
        sessions: [
          { id: '1', version: 'A' },
          { id: '3', version: 'B' },
        ],
      },
      {
        category: 'Pull',
        sessions: [
          { id: '2', version: 'A' },
          { id: '4', version: 'B' },
        ],
      },
      {
        category: 'Legs',
        sessions: [
          { id: '5', version: 'A' },
          { id: '7', version: 'B' },
        ],
      },
      { category: 'Shoulders & arms', sessions: [{ id: '6', version: 'A' }] },
    ])
  })
})

describe('instantiateTemplate', () => {
  it('creates versions with descriptions, exercises, targets, supersets and alternatives', () => {
    const rows = instantiateTemplate(push, names, ctx())
    expect(rows.missing).toEqual([])
    expect(rows.plan.name).toBe('Push')
    expect(rows.sessions.map((s) => s.name)).toEqual(['A', 'B'])
    expect(rows.sessions[0]!.notes).toMatch(/Chest, shoulders & triceps/)
    expect(rows.schedule).toEqual([])

    const a = rows.exercises.filter((e) => e.plan_session_id === rows.sessions[0]!.id)
    expect(a).toHaveLength(7)
    const tri = a.filter((e) => e.group_id)
    expect(tri).toHaveLength(2)
    expect(tri[0]!.group_id).toBe(tri[1]!.group_id)
    expect(tri[0]!.group_type).toBe('superset')
    expect(a[0]!.alternatives).toEqual([
      'id:Incline Machine Press',
      'id:Smith Machine Incline Press',
    ])

    const incline = rows.targets.filter((t) => t.plan_exercise_id === a[0]!.id)
    expect(incline.map((t) => [t.reps_min, t.reps_max, t.target_rir])).toEqual([
      [8, 12, 1],
      [8, 12, 1],
      [8, 12, 1],
    ])
  })

  it('reports unknown exercises instead of failing', () => {
    const rows = instantiateTemplate(push, new Map(), ctx())
    expect(rows.exercises).toEqual([])
    expect(rows.missing.length).toBeGreaterThan(0)
  })
})

describe('snapshots', () => {
  it('are stable regardless of timestamps and ignore deleted rows', () => {
    const rows = instantiateTemplate(push, names, ctx())
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
    // Push A: 3+3+3+3+3+3+2 = 20; Push B: 3+3+3+4+3+3 = 19
    expect(summariseSnapshot(a)).toBe('2 sessions · 13 exercises · 39 sets')
  })

  it('plans a restore: upsert snapshot rows, delete rows added since', () => {
    const rows = instantiateTemplate(push, names, ctx())
    const snap = buildSnapshot(rows)
    const added = { ...rows.targets[0]!, id: 'new-target' }
    const current = {
      ...rows,
      plan: { ...rows.plan, name: 'Renamed' },
      targets: [...rows.targets, added],
    }
    const r = planRestore(snap, current)
    expect(r.planPatch.name).toBe('Push')
    expect(r.deletions.targets.map((t) => t.id)).toEqual(['new-target'])
    expect(r.upserts.targets).toHaveLength(rows.targets.length)
  })

  it('ignore object key order (Postgres jsonb reorders keys)', () => {
    const snap = buildSnapshot(instantiateTemplate(push, names, ctx()))
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

  it('ignore created_at formatting differences between server and device', () => {
    const rows = instantiateTemplate(push, names, ctx())
    const fromServer = {
      ...rows,
      sessions: rows.sessions.map((s) => ({ ...s, created_at: '2026-10-31T10:00:00+00:00' })),
    }
    expect(snapshotKey(buildSnapshot(fromServer))).toBe(snapshotKey(buildSnapshot(rows)))
  })
})
