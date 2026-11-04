# Trainer

A personal trainer PWA for you and anyone you invite. Each account only ever sees its own data. It's installed on iPhone via Safari → **Add to Home Screen** and runs
entirely on free tiers (Supabase and Vercel).

- **Logging:** fast, offline set logging with a rest timer. Workouts are live (Start workout) or entered
  afterwards (Log workout). Weights can mean the total, each dumbbell, or left and right for single-arm moves.
- **Plans:** a plan builder and editor with drag-to-reorder and version history. Workouts can include cardio (e.g. 20 min running) as well as weights. A plan rating with
  one-tap fixes. "Suggested today" picks the best workout from what's left this week.
- **Analysis:** Progress charts, plan adherence, PBs and stalls, a rating for every workout, and weekly
  reports with 3 actions for next week.
- **Coaching:** a "Today's target" for each lift, plus suggestions you accept or skip (missed workouts,
  stalled lifts, muscles under or over target).
- **Nutrition:** protein for the day with one-tap foods (shake, chicken, eggs, bacon, or grams), a
  target of bodyweight × g/kg, and a bodyweight trend. Food itself stays in your food app.
- **Reminders:** push notifications sent by the server, with quiet hours and pause.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how data flows through the system.

## Stack

Vite, React 19 and TypeScript (strict) · Tailwind v4 · `vite-plugin-pwa` (custom service worker) ·
Dexie (IndexedDB) · Supabase (Postgres, Auth, Edge Functions, `pg_cron`) · Vitest · oxlint and Prettier.

> **Linting note:** the project uses TypeScript 7 (the native compiler). typescript-eslint relies on the
> TypeScript JS API, which TS 7 doesn't ship, so linting uses **oxlint** rather than ESLint.

## Prerequisites

- Node 24+
- Docker Desktop, for the local Supabase stack
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A free [Supabase](https://supabase.com) project and a free [Vercel](https://vercel.com) account

## Local development

```bash
npm install
supabase start            # first run pulls Docker images (a few minutes)
cp .env.example .env.local
# Paste the local "Publishable" key printed by `supabase start` (or `supabase status`) into VITE_SUPABASE_ANON_KEY
npm run dev               # http://localhost:5173
```

Locally, create an account from the sign-in screen (email confirmation is off).
Supabase Studio is at <http://127.0.0.1:54323>.

### Useful scripts

| Script               | What it does                                                     |
| -------------------- | ---------------------------------------------------------------- |
| `npm run check`      | Typecheck, lint and unit tests                                   |
| `npm test`           | Vitest (pure logic in `src/lib`)                                 |
| `supabase test db`   | pgTAP database tests (RLS) in `supabase/tests`                   |
| `npm run db:reset`   | Rebuild the local DB from migrations and the seed                |
| `npm run gen:types`  | Regenerate `src/db/database.types.ts` from the local schema      |
| `npm run gen:seed`   | Regenerate the reference-data migration from `src/lib/seed/*.ts` |
| `npm run gen:shared` | Copy the notification logic into the Edge Functions              |
| `npm run icons`      | Regenerate the PWA icons from `public/logo.svg`                  |

### Changing the exercise catalogue

Edit `src/lib/seed/exercises.ts`, then run `npm run gen:seed` and `npm run db:reset`. The muscles and
exercises are shipped as **migrations**, not in `seed.sql`, so `supabase db push` puts them on the hosted DB as
well. A migration that has already been applied won't run again on the hosted DB, so changes to the
catalogue need a new migration. `gen:seed` writes the latest catalogue refresh
(`20261103000000_load_modes.sql`); for later changes, add a new output file in
`scripts/gen-reference-sql.ts`. Each exercise also has a `loadMode`:
`total` (60 kg on the bar, bar included), `per_hand` (each dumbbell or handle) or `per_side`
(single-arm or single-leg: left and right logged side by side). To rename an exercise without losing
its history, keep its old name in `ID_NAMES`. Seeded exercise IDs are deterministic UUIDv5s generated from the name (see `scripts/seed-ids.ts`). CI
fails if the generated migration is out of date.

## Hosted Supabase setup

1. Create a free project at supabase.com. Pick the London region (`eu-west-2`) if it's offered.
2. Link the project and push the schema:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
3. **Auth settings** are kept in `supabase/config.toml`. The `[remotes.production]` block holds the
   hosted overrides (Site URL, redirect URLs, "Confirm email" off). Apply them with `supabase config push`.
   This is the step that turns off "Confirm email" so password sign-up works without an email link.
4. **Project Settings → API Keys:** copy the Project URL and the publishable key for the next section.
5. Sign-up is **invite-only**: an account can only be created for an email in `public.invites`
   (see below). Invite yourself before creating your account.

> **Why password sign-in?** Email links on iOS open in Safari, which can't share its storage with the
> Home Screen app. On the free tier, Supabase can't customise emails to send a code instead unless
> you configure custom SMTP.
>
> Free-tier projects pause after 7 days with no API activity. Normal use of the app (and the
> notification cron) keeps the project active.

## Inviting someone

1. In the Supabase dashboard, open **SQL Editor** and run:
   ```sql
   insert into public.invites (email) values ('friend@example.com');
   ```
   Use lower case. To remove an invite, `delete from public.invites where email = '...';` (this
   doesn't delete an account they've already made; do that under **Authentication → Users**).
2. Send them the app link. They follow [Installing on iPhone](#installing-on-iphone) and tap
   **Been invited? Create an account**, using that email.

Everyone else gets "This email isn't invited yet". Their data is private to them: row-level security
means each account can only read and write its own rows.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, choose **Add New → Project**, import the repo, and keep the framework as Vite.
3. Add these environment variables (Production and Preview):
   - `VITE_SUPABASE_URL`: your hosted Project URL
   - `VITE_SUPABASE_ANON_KEY`: your hosted anon/publishable key
4. Deploy. Every push to `main` redeploys.

**Let other people open it:** in Vercel, **Settings → Deployment Protection**, turn off **Vercel
Authentication**. Otherwise the app link shows a Vercel login first. The app has its own sign-in,
and your data is protected by Supabase, not by Vercel.

`vercel.json` adds security headers (a strict Content Security Policy, no framing) and the SPA rewrite and makes sure `sw.js`, the manifest and `index.html` are never cached
stale.

## Installing on iPhone

1. Open the deployed URL in **Safari** (it must be Safari).
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Open **Trainer** from the Home Screen. It runs full screen, with no Safari bars.
4. The first time, tap **Been invited? Create an account** and choose a password (8+ characters). iCloud Keychain can save it. After
   that you stay signed in.

Push notifications need iOS 16.4 or later and only work in the Home Screen app.

## Notifications (Web Push)

Reminders are decided and sent by the server, so they arrive with the app closed. Every 5 minutes
`pg_cron` calls the `notify` Edge Function. It checks your rules (Settings → Notifications) and
sends what's due. Each reminder has a key in `notification_log`, so it's never sent twice.

**Setting it up on the hosted project (once):**

1. Make a key pair: `npx web-push generate-vapid-keys`. Put the **public** key in
   `PROD_VAPID` in `src/features/settings/push.ts` (it's safe to ship). Keep the private key secret.
2. Set the function secrets:
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...      VAPID_SUBJECT=https://<your-app>.vercel.app NOTIFY_SECRET=<long random string>
   ```
3. Deploy: `supabase db push`, then `supabase functions deploy notify --no-verify-jwt` and
   `supabase functions deploy test-push`.
4. Point the cron job at the function by calling `configure_notify` with the service role key:
   ```bash
   curl -X POST "https://<ref>.supabase.co/rest/v1/rpc/configure_notify"      -H "apikey: <service role key>" -H "Authorization: Bearer <service role key>"      -H "Content-Type: application/json"      -d '{"url": "https://<ref>.supabase.co/functions/v1/notify", "secret": "<NOTIFY_SECRET>"}'
   ```
5. On the iPhone (from the Home Screen app): More → Settings → Enable notifications → Send test.

**Locally:** put the same four values in `supabase/functions/.env` (git-ignored) and the public key
in `VITE_VAPID_PUBLIC_KEY` in `.env.local`, then
`supabase functions serve --env-file supabase/functions/.env --no-verify-jwt`.
`npm run test:integration` checks the `notify` function end to end.

The scheduling logic lives in `src/lib/notify` and is unit-tested. `npm run gen:shared` copies it
into `supabase/functions/_shared` for the Edge Functions (CI checks the copy is current). After
changing it, redeploy with `supabase functions deploy notify --no-verify-jwt`.

## Weekly reports

Reports are built on the phone from your logs (More → Weekly reports). The Sunday rundown push
opens the week's report. Finished weeks are also saved to `weekly_reports`.

**Optional AI note (off by default):** a short write-up by Claude on top of the rules-based report.
Only the report's numbers are sent, never raw logs. To switch it on:

1. `supabase secrets set ANTHROPIC_API_KEY=...`
2. `supabase functions deploy report-summary`
3. Set `VITE_REPORT_AI=on` in Vercel's environment variables and redeploy.

## Security

- **Nothing secret is in the repo.** `.env.local` and `supabase/functions/.env` are git-ignored.
  The values in the code (Supabase URL, publishable key, VAPID public key) are public by design:
  the publishable key can only do what row-level security allows.
- **Server-only secrets** (`VAPID_PRIVATE_KEY`, `NOTIFY_SECRET`, `ANTHROPIC_API_KEY`) are set
  with `supabase secrets set`. The cron job's copy of `NOTIFY_SECRET` lives in Supabase Vault.
  Never put them in a `VITE_` variable: those are baked into the app for anyone to read.
- **Row-level security on every table.** pgTAP tests (`supabase/tests/rls.test.sql`) check one
  user can't see another's rows, that strangers can't sign up, and that clients can't read the invite
  list or trigger the cron.
- **The AI note costs you money** if switched on, since it's your API key. It only accepts the last
  few weeks, at most once per week each, with a size cap.
- **Signing out** wipes this phone's local copy and stops its reminders, so a shared phone is safe.
- Dependabot opens weekly PRs for vulnerable dependencies; `npm audit` should stay clean.

## Project layout

```
src/app         routing, layout, tab bar, error boundary
src/features    screens grouped by feature
src/components  shared UI
src/lib         PURE logic and Vitest tests:
                  analysis (volume, strength, adherence), rating (plan score), report (weekly),
                  adaptive (today's target, coach suggestions), review (workout rating),
                  plans (builder, templates, suggested workout), logging (load modes, rest, PBs),
                  notify (what's due), seed (catalogue), time, ui
src/db          Supabase client, Dexie schema, outbox and sync worker, generated DB types
src/sw.ts       service worker (precache, offline SPA, push, notificationclick)
supabase/       migrations, pgTAP tests, Edge Functions (notify, test-push, report-summary)
scripts/        code generators
```
