# Architecture

## Data flow

```
iPhone (standalone PWA)
  React UI ──reads──▶ Dexie (IndexedDB)   ◀── useLiveQuery keeps the UI reactive
     │ writes               │
     ▼                      │ outbox table (survives app restarts)
  local write + outbox ─────┘
     │ sync worker (on online / app focus / interval)
     ▼
  Supabase Postgres (RLS: user_id = auth.uid())
     ▲ pull "changes since cursor" (server-owned updated_at)
     │
  pg_cron (*/5 min) ──▶ Edge Function `notify` ──▶ Web Push (VAPID) ──▶ Apple push service ──▶ SW `push`
  pg_cron (Sun 19:00 Europe/London) ──▶ Edge Function `weekly-report` ──▶ weekly_reports + push
```

## Principles

- **Local-first.** Screens read from and write to IndexedDB, never directly to the network. Each local
  write also adds an `outbox` entry in the same Dexie transaction, so a logged set can't be lost
  between the two writes.
- **Idempotent sync.** IDs are UUIDv7s generated on the client. Pushing sends an upsert on the primary
  key, so a retry after a timeout can't create duplicates. The outbox drains strictly in order and
  stops at the first failure, because later writes may depend on earlier ones (a set depends on its
  session).
- **Server-owned `updated_at`.** A trigger sets it on every write, which makes it a safe cursor for
  pulls. Conflicts resolve last-write-wins, which is fine for a single user on a few devices.
- **Soft deletes** (`deleted_at`). Deletes sync like any other change and make undo possible.
- **RLS everywhere.** Every user table carries `user_id` (defaulting to `auth.uid()`), including child
  tables, so the policy is always the same `user_id = auth.uid()`. The seeded catalogue rows have
  `user_id IS NULL` and are read-only. `notification_log` is written only by the service role.
- **Pure logic in `src/lib`.** Analysis, progression, rating, chart shaping and notification due-time
  evaluation use no DOM or Node APIs, so the server-side engines can share them with the Deno Edge
  Functions (copied into `supabase/functions/_shared`, with a CI check that the copies match). They
  are unit-tested with Vitest.
- **Time zones.** Times of day are stored as `time` plus an IANA `tz` (default `Europe/London`), and
  are evaluated with DST-aware functions. Naive local times are never stored as UTC.
- **All scheduling is server-side.** The phone never schedules notifications itself.

## Auth

Sign-in uses a Supabase email OTP (a 6-digit code). Magic links aren't used: on iOS they open in
Safari, which can't share its storage with the Home Screen app. The session is persisted in
`localStorage` under `trainer-auth`.

## Reference data

Muscles (17) and about 140 seeded exercises are defined as typed data in `src/lib/seed/`.
`scripts/gen-reference-sql.ts` turns them into a migration, using deterministic UUIDv5 IDs. Defining
them in TypeScript means the analysis code and its fixtures use exactly the same catalogue and
muscle weights as the database (1.0 for a primary mover, 0.5 for a secondary).

## Service worker

`src/sw.ts` uses the `injectManifest` strategy. It precaches the build, serves `index.html` for in-app
navigations (offline), and handles `push` and `notificationclick`. When the app is already open, a
notification tap sends the app a `navigate` message so in-memory state survives. Otherwise it opens a
new window at the deep link.
