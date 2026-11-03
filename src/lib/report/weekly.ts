/** The weekly rundown: what you did, how it compares, and up to 3 things to do next week. */
import { summariseAdherence, weeklyAdherence, type PlannedWorkout } from '../analysis/adherence'
import { actualMuscles, type MuscleContext } from '../analysis/muscles'
import { exerciseTrend, recentPbs, strengthSeries } from '../analysis/strength'
import { addDays, isWorking, tonnageOf, type TrainingSession } from '../analysis/training'
import type { MuscleVolume, Rating } from '../rating/rate'
import { PULL_MUSCLES, PUSH_MUSCLES, SUGGEST_FOR_MUSCLE } from '../rating/rules'

export interface ReportInput {
  /** Monday of the week */
  week: string
  today: string
  /** Every logged workout */
  sessions: readonly TrainingSession[]
  ctx: MuscleContext
  /** Active plan */
  plan: {
    id: string
    workouts: readonly PlannedWorkout[]
    /** First day it was in use */
    since: string
    rating: Rating
  } | null
  protein: { logs: readonly { date: string; grams: number }[]; target: number | null }
}

export interface ReportPb {
  exerciseId: string
  name: string
  weightKg: number
  reps: number
  e1rm: number
  gain: number
}

export interface ReportStall {
  exerciseId: string
  name: string
  /** Workouts since the last best */
  workouts: number
  resetKg: number
}

export type ActionKind =
  | 'missed'
  | 'stall'
  | 'low'
  | 'high'
  | 'balance'
  | 'protein'
  | 'effort'
  | 'progress'
  | 'streak'
  | 'plan'

export interface ReportAction {
  id: string
  kind: ActionKind
  title: string
  detail: string
  link?: { to: string; label: string }
}

export interface WeeklyReport {
  version: 1
  week: string
  /** False while the week is still going (Mon–Sat) */
  final: boolean
  workouts: { done: number; planned: number | null; missed: string[] }
  /** 0–1, how closely the plan was followed */
  adherence: number | null
  streak: number
  sets: number
  tonnage: number
  last: { done: number; sets: number; tonnage: number }
  /** Muscles not paused */
  muscles: MuscleVolume[]
  pbs: ReportPb[]
  stalls: ReportStall[]
  balance: string[]
  protein: { days: number; hit: number; avg: number; target: number } | null
  /** Average reps in reserve on working sets that recorded it */
  rir: number | null
  headline: string
  actions: ReportAction[]
}

const MAX_ACTIONS = 3
const PROTEIN_HIT = 0.9

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const roundTo = (n: number, step: number) => Math.round(n / step) * step
const half = (n: number) => Math.round(n * 2) / 2

/** "A", "A and B", "A, B and C" */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

function totals(sessions: readonly TrainingSession[]) {
  let sets = 0
  let tonnage = 0
  for (const s of sessions) {
    for (const x of s.sets) {
      if (!isWorking(x)) continue
      sets++
      tonnage += tonnageOf(x)
    }
  }
  return { done: sessions.length, sets, tonnage: Math.round(tonnage) }
}

export function buildWeeklyReport(input: ReportInput): WeeklyReport {
  const { week, today, ctx, plan } = input
  const end = addDays(week, 6)
  const final = today >= end
  const upTo = input.sessions.filter((s) => s.date <= end)
  const inWeek = upTo.filter((s) => s.date >= week)
  const lastWeek = upTo.filter((s) => s.date >= addDays(week, -7) && s.date < week)
  const name = (id: string) => ctx.exercises.get(id)?.name ?? 'Exercise'
  const now = totals(inWeek)
  const last = totals(lastWeek)

  // Plan: what was done vs missed, and the streak
  let planned: number | null = null
  let adherence: number | null = null
  let missed: string[] = []
  let streak = 0
  if (plan && plan.since <= end && plan.workouts.length) {
    const weeks = weeklyAdherence(
      plan.workouts,
      upTo,
      ctx.exercises,
      plan.since,
      final ? end : today,
    )
    const thisWeek = weeks.at(-1)
    if (thisWeek) {
      planned = thisWeek.planned
      adherence = thisWeek.score
      missed = plan.workouts.flatMap((w) => {
        const done = thisWeek.sessions.filter((s) => s.workoutId === w.id).length
        return Array.from({ length: Math.max(0, w.perWeek - done) }, () => w.name)
      })
    }
    streak = summariseAdherence(weeks, final ? end : today).currentStreak
  }

  const muscles = actualMuscles(inWeek, ctx, 1).filter((m) => !m.paused)

  // PBs this week, best one per exercise
  const trained = new Set(inWeek.flatMap((s) => s.sets.filter(isWorking).map((x) => x.exerciseId)))
  const pbs: ReportPb[] = []
  for (const p of recentPbs(upTo, trained)) {
    if (p.date < week || pbs.some((x) => x.exerciseId === p.exerciseId)) continue
    pbs.push({
      exerciseId: p.exerciseId,
      name: name(p.exerciseId),
      weightKg: p.weightKg,
      reps: p.reps,
      e1rm: p.e1rm,
      gain: p.gain,
    })
  }

  // Lifts trained this week with no new best in a while
  const stalls: ReportStall[] = []
  for (const id of trained) {
    const series = strengthSeries(upTo, id)
    const trend = exerciseTrend(id, series)
    if (!trend?.stalled || (series.at(-1)?.date ?? '') < week) continue
    const best = series.reduce((a, p) => (p.e1rm > a.e1rm ? p : a))
    stalls.push({
      exerciseId: id,
      name: name(id),
      workouts: trend.sinceBest,
      resetKg: roundTo(best.weightKg * 0.9, 2.5),
    })
  }
  // Big lifts first
  const compound = (id: string) => Number(ctx.exercises.get(id)?.isCompound ?? false)
  stalls.sort((a, b) => compound(b.exerciseId) - compound(a.exerciseId) || b.workouts - a.workouts)

  // Imbalances
  const setsOf = (ids: readonly string[]) =>
    half(muscles.filter((m) => ids.includes(m.id)).reduce((a, m) => a + m.sets, 0))
  const push = setsOf(PUSH_MUSCLES)
  const pull = setsOf(PULL_MUSCLES)
  const quads = setsOf(['quads'])
  const hams = setsOf(['hamstrings'])
  const balance: string[] = []
  if (push + pull >= 10 && push > pull * 1.5)
    balance.push(`More pushing than pulling (${push} vs ${pull} sets).`)
  if (push + pull >= 10 && pull > push * 1.5)
    balance.push(`More pulling than pushing (${pull} vs ${push} sets).`)
  if (quads >= 6 && hams < quads / 2 && muscles.some((m) => m.id === 'hamstrings'))
    balance.push(`Quads got much more than hamstrings (${quads} vs ${hams} sets).`)

  // Protein, if logged
  let protein: WeeklyReport['protein'] = null
  const target = input.protein.target
  if (target) {
    const byDay = new Map<string, number>()
    for (const l of input.protein.logs) {
      if (l.date < week || l.date > end) continue
      byDay.set(l.date, (byDay.get(l.date) ?? 0) + l.grams)
    }
    if (byDay.size) {
      const days = [...byDay.values()]
      protein = {
        days: days.length,
        hit: days.filter((g) => g >= target * PROTEIN_HIT).length,
        avg: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
        target: Math.round(target),
      }
    }
  }

  const rirs = inWeek.flatMap((s) =>
    s.sets.filter(isWorking).flatMap((x) => (x.rir === null ? [] : [x.rir])),
  )
  const rir = rirs.length >= 5 ? half(rirs.reduce((a, b) => a + b, 0) / rirs.length) : null

  const report: WeeklyReport = {
    version: 1,
    week,
    final,
    workouts: { done: now.done, planned, missed },
    adherence,
    streak,
    sets: now.sets,
    tonnage: now.tonnage,
    last,
    muscles,
    pbs,
    stalls,
    balance,
    protein,
    rir,
    headline: '',
    actions: [],
  }
  report.headline = headline(report)
  report.actions = pickActions(report, input)
  return report
}

function headline(r: WeeklyReport): string {
  const { done, planned } = r.workouts
  if (!done) return r.final ? 'No workouts logged this week.' : 'No workouts logged yet this week.'
  const pbs = r.pbs.length ? `, ${plural(r.pbs.length, 'PB')}` : ''
  let text =
    planned && done >= planned
      ? `${r.final ? 'Full week' : 'Plan done'}: ${done} of ${planned} workouts${pbs}.`
      : planned
        ? `${done} of ${planned} workouts${pbs}.`
        : `${plural(done, 'workout')}${pbs}.`
  if (r.last.sets && r.final) {
    const pct = Math.round(((r.sets - r.last.sets) / r.last.sets) * 100)
    if (Math.abs(pct) >= 5)
      text += ` ${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}% on last week’s sets.`
  }
  return r.final ? text : `So far: ${text}`
}

interface Candidate extends ReportAction {
  priority: number
}

function pickActions(r: WeeklyReport, input: ReportInput): ReportAction[] {
  const { plan, ctx } = input
  const out: Candidate[] = []
  const { done, planned, missed } = r.workouts

  if (!plan) {
    out.push({
      id: 'plan',
      kind: 'plan',
      priority: 70,
      title: 'Set up a plan',
      detail: 'With a plan, this report can track what you missed and suggest exact fixes.',
      link: { to: '/plans', label: 'Plans' },
    })
  }

  if (planned && missed.length) {
    const unique = [...new Set(missed)]
    out.push({
      id: 'missed',
      kind: 'missed',
      priority: 100,
      ...(done === 0
        ? {
            title: r.final ? 'Get one workout in early' : 'Get a workout in',
            detail: `Start with ${plan?.workouts[0]?.name ?? 'your first workout'}. One session restarts the habit.`,
          }
        : r.final
          ? {
              title: `Don’t skip ${listNames(unique)}`,
              detail: `You did ${done} of ${planned}. If a day slips, move the workout to the next free day instead of dropping it.`,
            }
          : {
              title: `Still to do: ${listNames(unique)}`,
              detail: `${plural(missed.length, 'workout')} left this week.`,
            }),
    })
  }

  const stall = r.stalls[0]
  if (stall) {
    out.push({
      id: `stall:${stall.exerciseId}`,
      kind: 'stall',
      priority: 90,
      title: `${stall.name} has stalled`,
      detail: `No new best in ${plural(stall.workouts, 'workout')}. Drop to ${stall.resetKg} kg (about 90%)${ctx.focus === 'strength' ? ' for 3×5' : ''} and build back up over 2–3 weeks.`,
      link: { to: `/exercises/${stall.exerciseId}`, label: 'See lift' },
    })
  }

  // Short muscles: priority muscles first, then the biggest gap
  const low = r.muscles
    .filter((m) => m.status === 'low' && m.min > 0)
    .map((m) => ({ m, priority: ctx.muscles.find((g) => g.id === m.id)?.priority ?? false }))
    .toSorted(
      (a, b) =>
        Number(b.priority) - Number(a.priority) || b.m.min - b.m.sets - (a.m.min - a.m.sets),
    )
  for (const { m, priority } of low) {
    const inPlan = plan?.rating.muscles.find((x) => x.id === m.id)
    const planFix = plan?.rating.lacking.find((p) => p.muscleId === m.id)?.fix
    const base = { id: `low:${m.id}`, kind: 'low' as const, priority: 80 + (priority ? 5 : 0) }
    const got = `${m.name} got ${m.sets} sets; aim for ${m.min}+ a week.`
    if (inPlan && inPlan.status !== 'low') {
      // The plan covers it: the gap came from skipping
      if (missed.length) continue
      out.push({
        ...base,
        title: `Do all your ${m.name.toLowerCase()} sets`,
        detail: `${got} Your plan has ${inPlan.sets}, so finish the planned sets first.`,
      })
    } else if (planFix?.kind === 'add' && plan) {
      out.push({
        ...base,
        title: planFix.text,
        detail: `${got} Your plan is short on it too.`,
        link: { to: `/plans/${plan.id}/rating`, label: 'Fix in plan' },
      })
    } else {
      const add = Math.min(4, Math.max(2, Math.ceil((m.min - m.sets) / 2)))
      const ex = SUGGEST_FOR_MUSCLE[m.id]?.[0]
      out.push({
        ...base,
        title: ex ? `Add ${add} sets of ${ex}` : `Add ${add} sets for ${m.name.toLowerCase()}`,
        detail: got,
      })
    }
  }

  for (const m of r.muscles.filter((x) => x.status === 'high' && x.sets > x.max)) {
    out.push({
      id: `high:${m.id}`,
      kind: 'high',
      priority: 60,
      title: `Ease off ${m.name.toLowerCase()}`,
      detail: `${m.sets} sets is over your ${m.max} max. Drop about ${Math.ceil(m.sets - m.max)}; past this it adds fatigue more than growth.`,
    })
  }

  const note = r.balance[0]
  if (note) {
    out.push({
      id: 'balance',
      kind: 'balance',
      priority: 55,
      title: note.startsWith('Quads') ? 'Add hamstring work' : 'Even out push and pull',
      detail: `${note} Keeping them close helps posture and protects shoulders and knees.`,
    })
  }

  if (r.protein && r.protein.hit < r.protein.days * 0.6) {
    out.push({
      id: 'protein',
      kind: 'protein',
      priority: 50,
      title: 'Hit protein more often',
      detail: `Target hit on ${r.protein.hit} of ${plural(r.protein.days, 'day')} logged (avg ${r.protein.avg} g vs ${r.protein.target} g).`,
    })
  }

  if (r.rir !== null && r.rir >= 3) {
    out.push({
      id: 'effort',
      kind: 'effort',
      priority: 45,
      title: 'Train a bit closer to failure',
      detail: `Your sets averaged ${r.rir} reps in reserve. Aim for 1–3 on most sets.`,
    })
  }

  // Fillers for a good week
  const top = topLift(input)
  if (top) {
    out.push({
      id: `progress:${top.exerciseId}`,
      kind: 'progress',
      priority: 20,
      title: `Beat your ${top.name}`,
      detail: `Best set this week: ${top.weightKg} kg × ${top.reps}. Add a rep, or 2.5 kg once you hit the top of your range.`,
    })
  }
  if (r.streak > 0) {
    out.push({
      id: 'streak',
      kind: 'streak',
      priority: 10,
      title: `Keep the ${plural(r.streak, 'week')} streak going`,
      detail: 'Same plan, same days. Consistency is what adds up.',
    })
  }

  const picked: Candidate[] = []
  for (const c of out.toSorted((a, b) => b.priority - a.priority)) {
    if (picked.length >= MAX_ACTIONS) break
    if (c.kind === 'low' && picked.filter((p) => p.kind === 'low').length >= 2) continue
    picked.push(c)
  }
  return picked.map((c) => ({
    id: c.id,
    kind: c.kind,
    title: c.title,
    detail: c.detail,
    ...(c.link && { link: c.link }),
  }))
}

/** The compound done most this week, with its best set (by e1RM). */
function topLift(input: ReportInput) {
  const end = addDays(input.week, 6)
  const best = new Map<string, { n: number; weightKg: number; reps: number; v: number }>()
  for (const s of input.sessions) {
    if (s.date < input.week || s.date > end) continue
    for (const x of s.sets) {
      const info = input.ctx.exercises.get(x.exerciseId)
      if (!isWorking(x) || !info?.isCompound || x.weightKg <= 0 || x.reps < 1) continue
      const v = x.weightKg * (1 + x.reps / 30)
      const cur = best.get(x.exerciseId)
      if (!cur) best.set(x.exerciseId, { n: 1, weightKg: x.weightKg, reps: x.reps, v })
      else {
        cur.n++
        if (v > cur.v) Object.assign(cur, { weightKg: x.weightKg, reps: x.reps, v })
      }
    }
  }
  const [id, b] = [...best].toSorted((a, z) => z[1].n - a[1].n || z[1].v - a[1].v)[0] ?? []
  if (!id || !b) return null
  return {
    exerciseId: id,
    name: input.ctx.exercises.get(id)?.name ?? 'Exercise',
    weightKg: b.weightKg,
    reps: b.reps,
  }
}

/** Monday (YYYY-MM-DD) of an ISO week like '2026-W45'. */
export function mondayOfIsoWeek(iso: string): string | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(iso)
  if (!m) return null
  const year = Number(m[1])
  const week = Number(m[2])
  if (week < 1 || week > 53) return null
  // 4 Jan is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const monday1 = Date.UTC(year, 0, 4 - ((jan4.getUTCDay() || 7) - 1))
  return new Date(monday1 + (week - 1) * 7 * 86_400_000).toISOString().slice(0, 10)
}

/**
 * The same UUID for the same user and week on every device, so two phones saving one week's
 * report update one row instead of clashing.
 */
export function reportId(userId: string, iso: string): string {
  const text = `${userId}:${iso}`
  // Four 32-bit FNV-1a hashes with different seeds
  const parts = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b].map((seed) => {
    let h = seed >>> 0
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, '0')
  })
  const hex = parts.join('')
  // Version 8 (custom), RFC variant
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${((parseInt(hex[16]!, 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
