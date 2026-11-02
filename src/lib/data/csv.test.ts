import { describe, expect, it } from 'vitest'
import { importSets, parseCsv, SET_COLUMNS, toCsv } from './csv'

const ids = new Map([
  ['Lat Pulldown', 'ex-lat'],
  ["Farmer's Walk", 'ex-farmer'],
])

describe('csv', () => {
  it('quotes cells that need it and parses them back', () => {
    const csv = toCsv(
      ['name', 'note'],
      [
        ['Push, A', 'said "go"'],
        ['Pull', 'line\nbreak'],
        ['Arms', null],
      ],
    )
    expect(csv).toBe('name,note\r\n"Push, A","said ""go"""\r\nPull,"line\nbreak"\r\nArms,\r\n')
    expect(parseCsv(csv)).toEqual([
      ['name', 'note'],
      ['Push, A', 'said "go"'],
      ['Pull', 'line\nbreak'],
      ['Arms', ''],
    ])
  })

  it('ignores a byte-order mark and blank lines', () => {
    expect(parseCsv('﻿a,b\n\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})

describe('importSets', () => {
  it('groups rows into workouts by date, time and name (round-trips an export)', () => {
    const csv = toCsv(SET_COLUMNS, [
      ['2026-10-20', '18:05', 'Pull A', 'Lat Pulldown', 'warmup', 30, 12, '', ''],
      ['2026-10-20', '18:05', 'Pull A', 'lat pulldown', 'working', 60, 10, '', 1],
      ['2026-10-20', '18:05', 'Pull A', "Farmer's Walk", 'working', 24, 0, 40, 2],
      ['2026-10-22', '07:30', 'Pull A', 'Lat Pulldown', '', 62.5, 8, '', 0],
    ])
    const { workouts, errors } = importSets(csv, ids)
    expect(errors).toEqual([])
    expect(workouts.map((w) => [w.date, w.time, w.name, w.sets.length])).toEqual([
      ['2026-10-20', '18:05', 'Pull A', 3],
      ['2026-10-22', '07:30', 'Pull A', 1],
    ])
    expect(workouts[0]!.sets[2]).toEqual({
      exerciseId: 'ex-farmer',
      setType: 'working',
      weightKg: 24,
      reps: 0,
      seconds: 40,
      rir: 2,
    })
    expect(workouts[1]!.sets[0]!.setType).toBe('working') // blank = working
  })

  it('reports bad rows by line and keeps the good ones', () => {
    const csv = [
      'date,exercise,reps,weight_kg,rir',
      '2026-10-20,Lat Pulldown,10,60,1',
      '20/10/2026,Lat Pulldown,10,60,1',
      '2026-10-20,Bench Wobble,10,60,1',
      '2026-10-20,Lat Pulldown,ten,60,1',
      '2026-10-20,Lat Pulldown,10,60,11',
    ].join('\n')
    const { workouts, errors } = importSets(csv, ids)
    expect(workouts).toHaveLength(1)
    expect(workouts[0]!.name).toBe('Imported workout')
    expect(errors).toEqual([
      'Line 3: date should look like 2026-10-31.',
      'Line 4: no exercise called "Bench Wobble".',
      'Line 5: reps should be a whole number.',
      'Line 6: RIR should be 0–10.',
    ])
  })

  it('needs date, exercise and reps columns', () => {
    expect(importSets('date,weight\n2026-10-20,60', ids).errors).toEqual([
      'Missing a "exercise" column.',
      'Missing a "reps" column.',
    ])
  })
})
