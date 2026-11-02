# Trainer

A single-user personal trainer PWA: fast offline set logging, customisable plans, analysis, weekly
rundowns and server-scheduled push reminders. It's installed on iPhone via Safari → **Add to Home Screen**.
It runs entirely on free tiers (Supabase and Vercel).

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
exercises are shipped as a **migration**, not in `seed.sql`, so `supabase db push` puts them on the hosted DB as
well. Seeded exercise IDs are deterministic UUIDv5s generated from the name (see `scripts/seed-ids.ts`). CI
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
5. After you've created your own account in the app, set `enable_signup = false` under
   `[remotes.production.auth]` and run `supabase config push` again, so nobody else can register.

> **Why password sign-in?** Email links on iOS open in Safari, which can't share its storage with the
> Home Screen app. On the free tier, Supabase can't customise emails to send a code instead unless
> you configure custom SMTP.
>
> Free-tier projects pause after 7 days with no API activity. Normal use of the app (and the
> notification cron, from Phase 4) keeps the project active.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, choose **Add New → Project**, import the repo, and keep the framework as Vite.
3. Add these environment variables (Production and Preview):
   - `VITE_SUPABASE_URL`: your hosted Project URL
   - `VITE_SUPABASE_ANON_KEY`: your hosted anon/publishable key
4. Deploy. Every push to `main` redeploys.

`vercel.json` adds the SPA rewrite and makes sure `sw.js`, the manifest and `index.html` are never cached
stale.

## Installing on iPhone

1. Open the deployed URL in **Safari** (it must be Safari).
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Open **Trainer** from the Home Screen. It runs full screen, with no Safari bars.
4. The first time, tap **Create an account** and choose a password. iCloud Keychain can save it. After
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
into `supabase/functions/_shared` for the Edge Functions (CI checks the copy is current).

## Project layout

```
src/app         routing, layout, tab bar, error boundary
src/features    screens grouped by feature
src/components  shared UI
src/lib         PURE logic and Vitest tests (seed catalogue, platform detection, later analysis/progression…)
src/db          Supabase client, Dexie schema, outbox and sync worker, generated DB types
src/sw.ts       service worker (precache, offline SPA, push, notificationclick)
supabase/       migrations, pgTAP tests, edge functions (later)
scripts/        code generators
```
