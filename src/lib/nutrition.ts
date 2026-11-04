/** Protein and bodyweight: targets, quick-add foods, daily totals and the weight trend. */
import { addDays } from './analysis/training'

export const DEFAULT_G_PER_KG = 1.8

/** Daily protein target in grams: bodyweight × g/kg, or null without a weight. */
export function proteinTarget(kg: number | null, gPerKg: number | null): number | null {
  if (!kg || kg <= 0) return null
  return Math.round(kg * (gPerKg && gPerKg > 0 ? gPerKg : DEFAULT_G_PER_KG))
}

export interface QuickFood {
  id: string
  name: string
  emoji: string
  /** Fixed grams of protein, added in one tap */
  grams?: number
  /** Or ask how much: protein per unit, the unit, a starting amount and step */
  perUnit?: number
  unit?: string
  start?: number
  step?: number
  /** Shown when asking how much */
  question?: string
}

/** Rough UK values: whey scoop, cooked chicken breast, large egg, back bacon rasher. */
export const QUICK_FOODS: readonly QuickFood[] = [
  { id: 'shake', name: 'Shake', emoji: '🥤', grams: 35 },
  {
    id: 'chicken',
    name: 'Chicken',
    emoji: '🍗',
    perUnit: 0.31,
    unit: 'g cooked',
    start: 150,
    step: 10,
    question: 'How much cooked chicken, in grams?',
  },
  {
    id: 'eggs',
    name: 'Eggs',
    emoji: '🥚',
    perUnit: 6,
    unit: 'eggs',
    start: 3,
    step: 1,
    question: 'How many eggs?',
  },
  {
    id: 'bacon',
    name: 'Bacon',
    emoji: '🥓',
    perUnit: 5,
    unit: 'rashers',
    start: 3,
    step: 1,
    question: 'How many rashers?',
  },
]

/** Protein in `amount` of a quick food, rounded to the gram. */
export function foodProtein(food: QuickFood, amount: number): number {
  if (food.grams) return food.grams
  return Math.max(0, Math.round(amount * (food.perUnit ?? 0)))
}

/** "Chicken (150 g cooked)" / "Eggs (3)" / "Shake" */
export function foodLabel(food: QuickFood, amount: number): string {
  if (food.grams) return food.name
  return food.unit?.startsWith('g')
    ? `${food.name} (${amount} ${food.unit})`
    : `${food.name} (${amount})`
}

export interface ProteinEntry {
  date: string
  grams: number
}

/** Grams per day from `from` to `to` inclusive, oldest first (days with nothing are 0). */
export function dailyProtein(
  entries: readonly ProteinEntry[],
  from: string,
  to: string,
): { date: string; grams: number }[] {
  const byDay = new Map<string, number>()
  for (const e of entries) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.grams)
  const out: { date: string; grams: number }[] = []
  for (let d = from; d <= to; d = addDays(d, 1))
    out.push({ date: d, grams: Math.round(byDay.get(d) ?? 0) })
  return out
}

/** Days that hit the target, out of days with anything logged (empty days aren't counted). */
export function daysHit(
  days: readonly { grams: number }[],
  target: number | null,
): { hit: number; logged: number } {
  const logged = days.filter((d) => d.grams > 0)
  return { hit: target ? logged.filter((d) => d.grams >= target).length : 0, logged: logged.length }
}

export interface WeighIn {
  date: string
  kg: number
}

/** Each weigh-in with the average of all weigh-ins in the 7 days up to it (smooths water swings). */
export function weightTrend(weighIns: readonly WeighIn[]): (WeighIn & { avg: number })[] {
  const sorted = weighIns.toSorted((a, b) => a.date.localeCompare(b.date))
  return sorted.map((w) => {
    const week = sorted.filter((x) => x.date <= w.date && x.date > addDays(w.date, -7))
    const avg = week.reduce((a, x) => a + x.kg, 0) / week.length
    return { ...w, avg: Math.round(avg * 10) / 10 }
  })
}

/**
 * Change in kg to the latest weigh-in, from the one nearest `days` before it (on or before), or
 * from the first weigh-in if they don't go back that far. `from` is the date compared against.
 */
export function weightChange(
  weighIns: readonly WeighIn[],
  days: number,
): { kg: number; from: string; full: boolean } | null {
  const sorted = weighIns.toSorted((a, b) => a.date.localeCompare(b.date))
  const latest = sorted.at(-1)
  if (!latest || sorted.length < 2) return null
  const since = addDays(latest.date, -days)
  const then = sorted.filter((w) => w.date <= since).at(-1)
  const base = then ?? sorted[0]!
  return { kg: Math.round((latest.kg - base.kg) * 10) / 10, from: base.date, full: Boolean(then) }
}
