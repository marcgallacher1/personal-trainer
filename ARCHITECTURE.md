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

Sign-in uses Supabase email and password, with "Confirm email" turned off. Email links aren't usable:
on iOS they open in Safari, which can't share its storage with the Home Screen app. Supabase's free
tier also can't customise emails to send codes instead. The session is persisted in `localStorage`
under `trainer-auth` and refreshes automatically, so you sign in once per device. Once your account
exists, sign-ups are disabled on the hosted project, so it stays single-user.

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

## Plans

A **plan** is one type of workout (Push, Pull, Shoulders & arms…). Each plan has versions A, B…
(`plan_sessions`), which contain planned exercises, which contain per-set targets. All of these are
ordinary synced rows. Versions can be assigned to weekdays (`plan_schedule`); anything scheduled
for today is offered first when you tap **Start plan**. There is no "active plan". Presets in
`src/lib/plans/templates.ts` are copied into normal rows by the pure `instantiateTemplate`. Older
mixed plans ("Push A, Pull A…") can be split into one plan per type. Version ids are kept, so
logged workouts stay linked.

**Version history:** when you leave a plan screen, the plan's live rows are snapshotted into
`plan_versions`, but only if they differ from the latest version. The comparison ignores key order
and `created_at`, because Postgres `jsonb` and server timestamps format differently from the
device. Restoring a version first saves the current state as a new version, then upserts the
snapshot's rows and soft-deletes anything added since.

**Workouts from plans:** `startFromPlan` copies a version's exercises into the workout, linked by
`plan_exercise_id`, and names it e.g. "Push A". Each logged set records its `plan_set_target_id`.
Targets are shown as hints only; weights never carry over between workouts. Mid-workout edits
(add, swap, remove) ask whether to apply them today only or also to the plan.

## Navigation

Home-screen apps have no browser back button, so every screen has a top-left **Back**. It goes to
the previous screen, or to a sensible parent when the app was opened directly on that screen.
Leaving a workout with nothing logged cancels it, so a mis-tap never leaves an empty workout
behind.
