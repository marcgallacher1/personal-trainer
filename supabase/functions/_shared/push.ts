// Sends a Web Push to every device a user has subscribed. Dead subscriptions (404/410) are removed.
import webpush from 'npm:web-push@3.6.7'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

export interface PushPayload {
  title: string
  body: string
  url: string
  tag?: string
}

export async function sendToUser(
  db: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<{ delivered: number; error?: string }> {
  const { data: subs, error } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
    .is('deleted_at', null)
  if (error) return { delivered: 0, error: error.message }

  let delivered = 0
  const errors: string[] = []
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 6, urgency: 'high' },
      )
      delivered++
      await db
        .from('push_subscriptions')
        .update({ last_success_at: new Date().toISOString() })
        .eq('id', s.id)
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        // The phone dropped this subscription; it re-subscribes next time the app opens
        await db
          .from('push_subscriptions')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', s.id)
      }
      errors.push(`${status ?? ''} ${(e as Error).message}`.trim())
    }
  }
  return delivered
    ? { delivered }
    : { delivered, error: errors.join('; ') || 'No devices subscribed' }
}
