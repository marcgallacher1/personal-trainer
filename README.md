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

Sign-in emails are caught locally by Mailpit at <http://127.0.0.1:54324>.
Supabase Studio is at <http://127.0.0.1:54323>.

### Useful scripts

| Script              | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `npm run check`     | Typecheck, lint and unit tests                                   |
| `npm test`          | Vitest (pure logic in `src/lib`)                                 |
| `supabase test db`  | pgTAP database tests (RLS) in `supabase/tests`                   |
| `npm run db:reset`  | Rebuild the local DB from migrations and the seed                |
| `npm run gen:types` | Regenerate `src/db/database.types.ts` from the local schema      |
| `npm run gen:seed`  | Regenerate the reference-data migration from `src/lib/seed/*.ts` |
| `npm run icons`     | Regenerate the PWA icons from `public/logo.svg`                  |

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
3. **Auth → Providers → Email:** keep Email enabled. "Confirm email" can stay on.
4. **Auth → Email Templates:** in both **Magic Link** and **Confirm signup**, include the one-time code
   `{{ .Token }}` (copy `supabase/templates/magic_link.html`). The app signs in with the 6-digit code,
   not the link. On iOS a link would open in Safari, whose storage is separate from the installed app.
5. **Auth → URL Configuration:** set the Site URL to your Vercel URL.
6. **Project Settings → API:** copy the Project URL and the anon/publishable key for the next section.

> Free-tier projects pause after 7 days with no API activity. Normal use of the app (and the
> notification cron, from Phase 4) keeps the project active.
>
> Supabase's built-in email sender is rate-limited to a few emails per hour. That's fine for one user
> signing in occasionally. For more, add custom SMTP (for example, Resend's free tier).

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
4. Enter your email, then type in the 6-digit code from the email.

Push notifications (Phase 4) need iOS 16.4 or later and only work in the Home Screen app.

## Web Push / VAPID keys

_Phase 4._ Generating the keys, setting `supabase secrets` and setting up `pg_cron` will be documented here.

## Project layout

```
src/app         routing, layout, tab bar, error boundary
src/features    screens grouped by feature
src/components  shared UI
src/lib         PURE logic and Vitest tests (seed catalogue, platform detection, later analysis/progression…)
src/db          Supabase client, Dexie schema, outbox and sync worker, generated DB types
src/sw.ts       service worker (precache, offline SPA, push, notificationclick)
supabase/       migrations, pgTAP tests, email templates, edge functions (later)
scripts/        code generators
```
