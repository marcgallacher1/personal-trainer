// Called by pg_cron every 5 minutes. Works out what's due for each user and sends it.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import {
  dueNotifications,
  londonParts,
  weeklyStreak,
  type NotifyState,
} from '../_shared/lib/notify/evaluate.ts'
import { ruleFromRow, type RuleRow } from '../_shared/lib/notify/rules.ts'
import { isoWeek, londonToIso } from '../_shared/lib/time/london.ts'
import { sendToUser } from '../_shared/push.ts'

const HOUR = 3_600_000

Deno.serve(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${Deno.env.get('NOTIFY_SECRET')}`) {
    return new Response('Unauthorised', { status: 401 })
  }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const body = (await req.json().catch(() => ({}))) as { now?: string }
  // `now` can be overridden for testing
  const now = body.now ?? new Date().toISOString()

  const { data: subs, error } = await db
    .from('push_subscriptions')
    .select('user_id')
    .is('deleted_at', null)
  if (error) return new Response(error.message, { status: 500 })

  const results: Record<string, unknown> = {}
  const users = new Set(subs.map((s) => s.user_id))

  for (const userId of users) {
    try {
      const state = await loadState(db, userId, now)
      const due = dueNotifications(state)
      const sent: string[] = []
      for (const d of due) {
        // The unique key is the real guard against sending twice
        const { error: dup } = await db.from('notification_log').insert({
          user_id: userId,
          type: d.type,
          idempotency_key: d.key,
          payload: { title: d.title, body: d.body, url: d.url },
          status: d.status === 'send' ? 'sent' : 'skipped',
          error: d.reason ?? null,
        })
        if (dup || d.status !== 'send') continue
        const outcome = await sendToUser(db, userId, {
          title: d.title,
          body: d.body,
          url: d.url,
          tag: d.key,
        })
        if (!outcome.delivered) {
          await db
            .from('notification_log')
            .update({ status: 'failed', error: outcome.error })
            .eq('user_id', userId)
            .eq('idempotency_key', d.key)
        }
        sent.push(d.key)
      }
      results[userId] = { due: due.length, sent }
    } catch (e) {
      results[userId] = { error: e instanceof Error ? e.message : String(e) }
    }
  }
  return Response.json({ now, results })
})

/** Gathers the facts the evaluator needs for one user. */
async function loadState(db: SupabaseClient, userId: string, now: string): Promise<NotifyState> {
  const today = londonParts(now)
  const dayStart = londonToIso(today.date, '00:00')
  const nowMs = Date.parse(now)
  const since = (hours: number) => new Date(nowMs - hours * HOUR).toISOString()

  const [
    profile,
    rules,
    plans,
    todaySessions,
    recent,
    history,
    bodyweight,
    protein,
    sentLog,
    report,
  ] = await Promise.all([
    db.from('profiles').select('*').eq('id', userId).single(),
    db.from('notification_rules').select('*').eq('user_id', userId).is('deleted_at', null),
    db
      .from('plans')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('deleted_at', null),
    db
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('started_at', dayStart),
    db
      .from('sessions')
      .select('id, name, started_at, ended_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('started_at', since(24)),
    db
      .from('sessions')
      .select('started_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('started_at', since(24 * 400)),
    db
      .from('bodyweight_logs')
      .select('kg, date')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .limit(30),
    db
      .from('protein_logs')
      .select('grams')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .eq('date', today.date),
    db
      .from('notification_log')
      .select('idempotency_key')
      .eq('user_id', userId)
      .gte('sent_at', since(72)),
    db
      .from('weekly_reports')
      .select('iso_week')
      .eq('user_id', userId)
      .eq('iso_week', isoWeek(today.date))
      .is('deleted_at', null),
  ])
  if (profile.error) throw new Error(profile.error.message)
  const p = profile.data

  // Active plan: workout names per weekday
  let plan: NotifyState['plan'] = null
  let perWeek = p.sessions_per_week ?? 4
  const planId = plans.data?.[0]?.id
  if (planId) {
    const [sessions, schedule] = await Promise.all([
      db.from('plan_sessions').select('id, name').eq('plan_id', planId).is('deleted_at', null),
      db
        .from('plan_schedule')
        .select('plan_session_id, weekday')
        .eq('plan_id', planId)
        .is('deleted_at', null),
    ])
    const names = new Map((sessions.data ?? []).map((s) => [s.id, s.name as string]))
    const days: Partial<Record<number, string[]>> = {}
    for (const d of schedule.data ?? []) {
      const name = names.get(d.plan_session_id)
      if (!name || !d.weekday) continue
      days[d.weekday] = [...(days[d.weekday] ?? []), name]
    }
    plan = { days }
    perWeek = Object.values(days).reduce((a, n) => a + (n?.length ?? 0), 0) || perWeek
  }

  // Workouts saved in the last 12 h that set PBs
  const finished = (recent.data ?? []).filter(
    (s) => s.ended_at && Date.parse(s.ended_at) > nowMs - 12 * HOUR,
  )
  const pbWorkouts: NotifyState['pbWorkouts'] = []
  if (finished.length) {
    const { data: prs } = await db
      .from('sets')
      .select('session_id, weight_kg, reps, duration_seconds, exercises(name)')
      .in(
        'session_id',
        finished.map((s) => s.id),
      )
      .eq('is_pr', true)
      .is('deleted_at', null)
    for (const s of finished) {
      const pbs = (prs ?? [])
        .filter((x) => x.session_id === s.id)
        .map((x) => {
          const ex = (x.exercises as { name?: string } | null)?.name ?? 'Exercise'
          return x.duration_seconds
            ? `${ex}: ${x.duration_seconds}s`
            : `${ex}: ${Number(x.weight_kg)} kg × ${x.reps}`
        })
      if (pbs.length) pbWorkouts.push({ id: s.id, name: s.name, pbs: [...new Set(pbs)] })
    }
  }

  const open = (recent.data ?? [])
    .filter((s) => !s.ended_at && Date.parse(s.started_at) > nowMs - 12 * HOUR)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0]
  const weight = Number(bodyweight.data?.[0]?.kg ?? p.bodyweight_kg ?? 0)
  const eaten = (protein.data ?? []).reduce((a, r) => a + Number(r.grams), 0)

  return {
    now,
    rules: (rules.data ?? []).map((r) => ruleFromRow(r as RuleRow)),
    quiet:
      p.quiet_start && p.quiet_end
        ? { start: p.quiet_start.slice(0, 5), end: p.quiet_end.slice(0, 5) }
        : null,
    pausedUntil: p.notifications_paused_until,
    goal:
      p.goal_event_name && p.goal_event_date
        ? { name: p.goal_event_name, date: p.goal_event_date }
        : null,
    plan,
    workoutToday: (todaySessions.data ?? []).length > 0,
    openWorkout: open ? { id: open.id, name: open.name, startedAt: open.started_at } : null,
    bodyweightToday: (bodyweight.data ?? []).some((b) => b.date === today.date),
    protein: { eaten, target: weight ? weight * Number(p.protein_g_per_kg ?? 1.8) : null },
    pbWorkouts,
    streakWeeks: weeklyStreak(
      (history.data ?? []).map((s) => londonParts(s.started_at).date),
      perWeek,
      today.date,
    ),
    rundown: report.data?.[0]?.iso_week ?? null,
    sent: new Set((sentLog.data ?? []).map((l) => l.idempotency_key)),
  }
}
