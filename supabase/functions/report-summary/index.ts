// Optional: a short, friendly write-up of a weekly report by Claude.
// Off unless ANTHROPIC_API_KEY is set. Only the report's numbers are sent, never raw logs.
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM = `You are a friendly, direct personal trainer writing a weekly check-in for one client.
You get their week as JSON (workouts, sets per muscle against their targets, PBs, stalled lifts,
balance notes, protein) and the 3 actions already chosen for next week.
Write 3 to 4 short sentences in plain British English: what went well, what didn't, and why the
actions matter. Use only the numbers given. No headings, lists, emoji or sign-off.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) return Response.json({ summary: null }, { headers: CORS })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  const { data: auth } = await db.auth.getUser(token)
  if (!auth.user) return Response.json({ error: 'Not signed in' }, { status: 401, headers: CORS })

  const { iso_week } = (await req.json().catch(() => ({}))) as { iso_week?: string }
  const { data: report } = await db
    .from('weekly_reports')
    .select('id, stats_json, recommendations_json, summary_text, llm_summary_text')
    .eq('user_id', auth.user.id)
    .eq('iso_week', iso_week ?? '')
    .is('deleted_at', null)
    .maybeSingle()
  if (!report) return Response.json({ summary: null }, { headers: CORS })
  if (report.llm_summary_text)
    return Response.json({ summary: report.llm_summary_text }, { headers: CORS })

  const client = new Anthropic({ apiKey: key })
  try {
    const res = await client.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            headline: report.summary_text,
            week: report.stats_json,
            actions: report.recommendations_json,
          }),
        },
      ],
    })
    if (res.stop_reason === 'refusal') return Response.json({ summary: null }, { headers: CORS })
    const summary = res.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('')
      .trim()
    if (!summary) return Response.json({ summary: null }, { headers: CORS })
    await db.from('weekly_reports').update({ llm_summary_text: summary }).eq('id', report.id)
    return Response.json({ summary }, { headers: CORS })
  } catch (e) {
    // The rules-based report still shows; this is just extra
    const message = e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e)
    return Response.json({ summary: null, error: message }, { headers: CORS })
  }
})
