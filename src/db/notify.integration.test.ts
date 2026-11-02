import { beforeAll, describe, expect, it } from 'vitest'
import { supabase } from './supabase'

/**
 * The notify Edge Function against the local stack. Needs `supabase start` and
 * `supabase functions serve --env-file supabase/functions/.env --no-verify-jwt`.
 * The device is fake, so sending fails at the push service; what's checked is the decision,
 * the log and that nothing is ever sent twice.
 */
const URL = import.meta.env.VITE_SUPABASE_URL as string
// Read from supabase/functions/.env by vitest.integration.config.ts
const SECRET = import.meta.env.VITE_NOTIFY_SECRET as string

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

async function devicePublicKey(): Promise<string> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])
  return b64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)))
}

const runNotify = async (now: string) => {
  const res = await fetch(`${URL}/functions/v1/notify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ now }),
  })
  expect(res.status).toBe(200)
  return (await res.json()) as { results: Record<string, { sent?: string[]; error?: string }> }
}

const myLog = async () => {
  const { data } = await supabase
    .from('notification_log')
    .select('idempotency_key, status, error, payload')
    .order('sent_at')
  return data ?? []
}

describe('notify function', () => {
  let userId = ''

  beforeAll(async () => {
    const { data, error } = await supabase.auth.signUp({
      email: `notify-${Date.now()}@test.local`,
      password: 'integration-pass-1',
    })
    if (error || !data.user) throw error ?? new Error('no user')
    userId = data.user.id
    // A fake device with real keys, so encryption runs
    const { error: subError } = await supabase.from('push_subscriptions').insert({
      endpoint: `https://web.push.apple.com/fake-${Date.now()}`,
      p256dh: await devicePublicKey(),
      auth: b64url(crypto.getRandomValues(new Uint8Array(16))),
    })
    expect(subError).toBeNull()
  })

  it('rejects calls without the cron secret', async () => {
    const res = await fetch(`${URL}/functions/v1/notify`, { method: 'POST', body: '{}' })
    expect(res.status).toBe(401)
  })

  it('sends the 15:00 gym reminder once, with no plan (every day counts)', async () => {
    // Wed 4 Nov 2026, 15:02 London (GMT)
    const first = await runNotify('2026-11-04T15:02:00Z')
    expect(first.results[userId]?.sent).toEqual(['gym:2026-11-04:15:00'])
    const again = await runNotify('2026-11-04T15:07:00Z')
    expect(again.results[userId]?.sent).toEqual([])

    const log = await myLog()
    expect(log.filter((l) => l.idempotency_key === 'gym:2026-11-04:15:00')).toHaveLength(1)
    // The fake device is rejected by the push service, which is recorded
    expect(log.find((l) => l.idempotency_key === 'gym:2026-11-04:15:00')?.status).toBe('failed')
  })

  it('logs but doesn’t send during quiet hours', async () => {
    await supabase
      .from('profiles')
      .update({ quiet_start: '14:00', quiet_end: '16:00' })
      .eq('id', userId)
    const r = await runNotify('2026-11-05T15:01:00Z')
    expect(r.results[userId]?.sent).toEqual([])
    const entry = (await myLog()).find((l) => l.idempotency_key === 'gym:2026-11-05:15:00')
    expect(entry).toMatchObject({ status: 'skipped', error: 'quiet hours' })
  })

  it('skips the reminder once a workout is started that day', async () => {
    await supabase
      .from('profiles')
      .update({ quiet_start: '22:00', quiet_end: '07:00' })
      .eq('id', userId)
    await supabase.from('sessions').insert({ started_at: '2026-11-06T09:00:00Z' })
    await runNotify('2026-11-06T15:01:00Z')
    const entry = (await myLog()).find((l) => l.idempotency_key === 'gym:2026-11-06:15:00')
    expect(entry).toMatchObject({ status: 'skipped', error: 'already logged' })
  })

  it('sends the Sunday rundown with the week so far, opening the report', async () => {
    const r = await runNotify('2026-11-08T19:01:00Z')
    expect(r.results[userId]?.sent).toContain('rundown:2026-W45')
    const entry = (await myLog()).find((l) => l.idempotency_key === 'rundown:2026-W45')
    expect(entry?.payload).toMatchObject({
      url: '/reports/2026-W45',
      body: expect.stringContaining('1 workout this week') as unknown,
    })
  })
})
