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
     └─ Sun 19:00: "weekly rundown" push (workouts so far) ──▶ opens /reports/<iso week>
  Reports screen ──▶ src/lib/report builds the week from local data ──▶ finished weeks saved to weekly_reports
     └─ optional (VITE_REPORT_AI=on + ANTHROPIC_API_KEY): Edge Function `report-summary` adds a Claude-written note
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
  pulls. Conflicts resolve last-write-wins, which is fine for one person on a few devices.
- **Soft deletes** (`deleted_at`). Deletes sync like any other change and make undo possible.
- **RLS everywhere.** Every user table carries `user_id` (defaulting to `auth.uid()`), including child
  tables, so the policy is always the same `user_id = auth.uid()`. The seeded catalogue rows have
  `user_id IS NULL` and are read-only. `notification_log` is written only by the service role.
- **Pure logic in `src/lib`.** Analysis, progression, rating, chart shaping and notification due-time
  evaluation use no DOM or Node APIs, so the server-side engines can share them with the Deno Edge
  Functions (copied into `supabase/functions/_shared`, with a CI check that the copies match). They
  are unit-tested with Vitest.
- **Weekly reports are built on the phone.** The report is a pure function of the logged data
  (`src/lib/report/weekly.ts`), so it always matches Progress and reflects late edits. Finished weeks
  are saved to `weekly_reports` (one row per user and ISO week, with an id derived from both so two
  devices never clash) for history and the optional AI summary. The rules-based report never
  depends on the AI.
- **Time zones.** Times of day are stored as `time` plus an IANA `tz` (default `Europe/London`), and
  are evaluated with DST-aware functions. Naive local times are never stored as UTC.
- **All scheduling is server-side.** The phone never schedules notifications itself.

## Auth

Sign-in uses Supabase email and password, with "Confirm email" turned off. Email links aren't usable:
on iOS they open in Safari, which can't share its storage with the Home Screen app. Supabase's free
tier also can't customise emails to send codes instead. The session is persisted in `localStorage`
under `trainer-auth` and refreshes automatically, so you sign in once per device. Sign-up is
invite-only: a `before insert` trigger on `auth.users` (`check_invite`) rejects any email not
matched in `public.invites`, which has RLS on and no policies, so only the project owner can edit it.
Signing out wipes local data and unsubscribes the device from push. If a different account signs in
on the same phone, `claimLocalData` clears the previous user's data first.

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

A **plan** is your week: a set of workouts (`plan_sessions`, e.g. "Push A", "Pull A", "Arms"),
each on one or more weekdays (`plan_schedule`). Workouts contain planned exercises, which contain
per-set targets. All of these are ordinary synced rows. Plans are optional. At most one plan is
active; the active plan drives Today, and switching it off is just a toggle.

**Building a plan:** the builder (`/plans/new`) shows preset workouts grouped by type (Push, Pull,
Shoulders & arms…, from `src/lib/plans/templates.ts`) plus "Create your own". Tapping a day on a
workout adds it to a draft plan (pure logic in `src/lib/plans/draft.ts`, kept in
`sessionStorage` until saved). **Save plan** copies each chosen workout into the plan as a normal,
fully editable workout (`instantiateWorkout`). On a saved plan, `/plans/:id/add` uses the same
screen but writes straight to the plan.

**Version history:** when you leave a plan screen, the plan's live rows are snapshotted into
`plan_versions`, but only if they differ from the latest version. The comparison ignores key order
and `created_at`, because Postgres `jsonb` and server timestamps format differently from the
device. Restoring a version first saves the current state as a new version, then upserts the
snapshot's rows and soft-deletes anything added since.

**Workouts from plans:** `startFromPlan` copies a version's exercises into the workout, linked by
`plan_exercise_id`, and names it e.g. "Push A". Each logged set records its `plan_set_target_id`.
Targets are shown as hints only: inputs start blank, and weights never carry over between workouts. Mid-workout edits
(add, swap, remove) ask whether to apply them today only or also to the plan.

**Cardio in a plan:** a plan workout can list cardio in `plan_sessions.cardio_json`, e.g.
`[{"activity": "run", "minutes": 20}]`. It lives on the workout row, so it syncs, versions and
restores with it. In a workout started from the plan, cardio not logged yet shows as a dashed
"Planned" row; tapping it opens the cardio logger pre-filled (`cardioLeft` in `src/lib/cardio.ts`).
Workouts with only cardio still count as done for adherence and suggestions.

**Cardio details:** each entry can carry optional extras in `cardio_entries.details_json`: speed
and incline (running, walking), level (gym machines), intervals (rounds, hard and easy seconds),
and pool length and lengths for swimming, which give the distance. `detailFields` in
`src/lib/cardio.ts` decides which extras each activity shows. The builder also has a Cardio preset.

## Navigation

Home-screen apps have no browser back button, so every screen has a top-left **Back**. It goes to
the previous screen, or to a sensible parent when the app was opened directly on that screen.
Leaving a workout with nothing logged cancels it, so a mis-tap never leaves an empty workout
behind.

## Notifications

The phone never schedules anything. `pg_cron` calls the `notify` Edge Function every 5 minutes.
It loads each subscribed user's rules, plan, today's workouts and what's already been sent, then
asks `dueNotifications()` (in `src/lib/notify`, pure and tested) what's due. Times are London
wall-clock times, so clock changes are handled. Quiet hours and pauses log a reminder as
"skipped" instead of sending it. The unique `(user_id, idempotency_key)` on `notification_log` is
the final guard against duplicates. Dead subscriptions (404/410) are removed, and the app
re-sends its subscription each time it starts.

## Logging

- **Live or afterwards.** **Start workout** (Today) times the workout live. **Log workout** (the Log
  tab) asks for the day, start time and length, and spaces the sets through that window.
- **What the weight means.** Each exercise has a `load_mode`:
  - `total`: the whole load, bar included.
  - `per_hand`: each of two dumbbells or handles, so volume counts double.
  - `per_side`: single-arm or single-leg moves. Left goes in `weight_kg`/`reps` and right in
    `right_weight_kg`/`right_reps`.

  Volume uses the real load (`src/lib/logging/load.ts`). PBs and strength trends use the stronger side.

- **Rest.** Rest is worked out from when each set was logged, minus about 45 s for doing the set
  (`src/lib/logging/rest.ts`). A live timer shows while you train. Gaps over 15 minutes aren't rest.

## Coaching

All of this is pure, tested logic in `src/lib`. Nothing changes the plan without you choosing it.

- **Today's target** (`adaptive/progression.ts`) uses double progression. Add reps until every set
  hits the top of the range, then add 2.5 kg (compounds) or 1 kg (isolations). Weights are only
  suggested once a lift has 3 workouts of data. Before that it just says the rep range. Bodyweight
  moves below the range count as building up, not failing.
- **Coach suggestions** (`adaptive/proposals.ts`) appear as one card on Today, with options and
  "Not now":
  - a missed workout: move it to a free day, or add its key lifts to the next workout;
  - a stalled lift (no new best in 3 workouts): a 90% reset, a different rep range, or a fair swap;
  - a muscle under or over target two weeks running, when the plan is the cause.

  Each decision is a `plan_changes` row (so it isn't asked again). Plan edits are saved as plan
  versions, which is the changelog. There are no deload suggestions, by choice.

- **Suggested today** (`plans/suggest.ts`) picks from the plan workouts not done this week. Muscles
  trained in the last 48 h count against a workout, and missed workouts come before today's scheduled
  one.

## Analysis

- **Plan adherence** (`analysis/adherence.ts`): week 1 is the week you first train on the plan (from
  its Monday, so a missed day that week counts). A week still in progress only counts the workouts
  due so far. Fair swaps count in full.
- **Workout rating** (`review/workout.ts`): starts at 100, and every point taken off comes with a
  "To work on" reason, e.g. down vs last time, skipped plan exercises, too many sets for one muscle,
  easy sets, or a very long session. It's worked out when you view it; nothing is stored.
- **Weekly report** (`report/weekly.ts`): see Principles above.

## Nutrition

More → Nutrition logs protein grams (`protein_logs`) and weigh-ins (`bodyweight_logs`, one per
day; logging again corrects it). Quick foods work out the grams (`src/lib/nutrition.ts`). The
target is the latest weigh-in, or the profile weight, × `protein_g_per_kg` (1.8 by default); a
newer weigh-in also updates `profiles.bodyweight_kg`, so the server reminders and reports use the
same target. The trend is a 7-day average of weigh-ins.
