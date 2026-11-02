/** CSV export/import for the Data screen (RFC 4180-style quoting). */

export type Cell = string | number | boolean | null | undefined

function escape(v: Cell): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replaceAll('"', '""')}"` : s
}

export function toCsv(columns: readonly string[], rows: readonly (readonly Cell[])[]): string {
  return [columns, ...rows].map((r) => r.map(escape).join(',')).join('\r\n') + '\r\n'
}

/** Parses CSV text into rows of strings (handles quotes, escaped quotes and newlines in cells). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''))
}

/** The set-level columns used for export and accepted for import. */
export const SET_COLUMNS = [
  'date',
  'time',
  'workout',
  'exercise',
  'set_type',
  'weight_kg',
  'reps',
  'seconds',
  'rir',
] as const

export interface ImportedSet {
  exerciseId: string
  setType: string
  weightKg: number
  reps: number
  seconds: number | null
  rir: number | null
}

export interface ImportedWorkout {
  date: string
  /** HH:MM, London */
  time: string
  name: string
  sets: ImportedSet[]
}

const num = (s: string) => (s === '' ? null : Number(s))

const SET_TYPES = ['warmup', 'working', 'drop', 'failure']

/**
 * Turns a sets CSV (as exported) into workouts: rows with the same date, time and workout name
 * become one workout. Unknown exercises and bad rows are reported, not guessed.
 */
export function importSets(
  text: string,
  exerciseIdByName: ReadonlyMap<string, string>,
): { workouts: ImportedWorkout[]; errors: string[] } {
  const [header, ...rows] = parseCsv(text)
  const errors: string[] = []
  if (!header) return { workouts: [], errors: ['The file is empty.'] }
  const col = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]))
  for (const need of ['date', 'exercise', 'reps']) {
    if (!col.has(need)) errors.push(`Missing a "${need}" column.`)
  }
  if (errors.length) return { workouts: [], errors }
  const get = (r: string[], name: string) => {
    const i = col.get(name)
    return i === undefined ? '' : (r[i] ?? '').trim()
  }
  const byLower = new Map([...exerciseIdByName].map(([n, id]) => [n.toLowerCase(), id]))

  const workouts = new Map<string, ImportedWorkout>()
  rows.forEach((r, i) => {
    const line = i + 2
    const date = get(r, 'date')
    const exercise = get(r, 'exercise')
    const exerciseId = byLower.get(exercise.toLowerCase())
    const reps = num(get(r, 'reps'))
    const weight = num(get(r, 'weight_kg')) ?? 0
    const seconds = num(get(r, 'seconds'))
    const rir = num(get(r, 'rir'))
    const setType = get(r, 'set_type').toLowerCase() || 'working'
    const time = get(r, 'time') || '12:00'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return void errors.push(`Line ${line}: date should look like 2026-10-31.`)
    if (!/^\d{1,2}:\d{2}$/.test(time))
      return void errors.push(`Line ${line}: time should look like 18:30.`)
    if (!exerciseId) return void errors.push(`Line ${line}: no exercise called "${exercise}".`)
    if (reps === null || !Number.isInteger(reps) || reps < 0)
      return void errors.push(`Line ${line}: reps should be a whole number.`)
    if (!Number.isFinite(weight) || weight < 0)
      return void errors.push(`Line ${line}: weight should be a number.`)
    if (seconds !== null && (!Number.isFinite(seconds) || seconds < 0))
      return void errors.push(`Line ${line}: seconds should be a number.`)
    if (rir !== null && (!Number.isInteger(rir) || rir < 0 || rir > 10))
      return void errors.push(`Line ${line}: RIR should be 0–10.`)
    if (!SET_TYPES.includes(setType))
      return void errors.push(`Line ${line}: set type should be ${SET_TYPES.join(', ')}.`)
    const name = get(r, 'workout') || 'Imported workout'
    const key = `${date} ${time} ${name}`
    const w = workouts.get(key) ?? { date, time: time.padStart(5, '0'), name, sets: [] }
    w.sets.push({ exerciseId, setType, weightKg: weight, reps, seconds, rir })
    workouts.set(key, w)
  })
  return { workouts: [...workouts.values()], errors }
}
