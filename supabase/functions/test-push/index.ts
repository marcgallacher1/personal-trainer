// "Send test notification" in Settings: pushes to the signed-in user's devices right away.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { sendToUser } from '../_shared/push.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user)
    return Response.json({ error: 'Not signed in' }, { status: 401, headers: CORS })

  const outcome = await sendToUser(db, data.user.id, {
    title: 'Test notification ✅',
    body: 'Notifications are working. See you at the gym.',
    url: '/settings',
    tag: 'test',
  })
  await db.from('notification_log').insert({
    user_id: data.user.id,
    type: 'test',
    idempotency_key: `test:${crypto.randomUUID()}`,
    status: outcome.delivered ? 'sent' : 'failed',
    error: outcome.error ?? null,
  })
  return Response.json(outcome, { status: outcome.delivered ? 200 : 502, headers: CORS })
})
