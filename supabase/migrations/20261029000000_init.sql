-- Trainer: initial schema.
-- Conventions:
--   * Every user-owned table has user_id (default auth.uid()), created_at, updated_at, deleted_at.
--   * IDs are generated client-side (UUIDv7) so offline upserts are idempotent; gen_random_uuid() is only a fallback.
--   * updated_at is set by the server on every write so clients can pull "changes since" a cursor.
--   * deleted_at = soft delete (sync + undo). Hard deletes only happen via account deletion cascade.
--   * Times of day are stored as `time` + an IANA `tz`, never as naive UTC.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference data (seeded, read-only to users)
-- ---------------------------------------------------------------------------
create table public.muscles (
  id text primary key,                       -- slug, e.g. 'front_delts'
  name text not null,
  region text not null check (region in ('upper', 'lower', 'core')),
  body_side text not null check (body_side in ('front', 'back')), -- for the heatmap
  sort_order int not null default 0
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade, -- NULL = seeded/global
  name text not null,
  equipment text not null check (equipment in
    ('barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band', 'smith', 'other')),
  pattern text not null check (pattern in
    ('horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
     'squat', 'hinge', 'lunge', 'carry', 'core', 'isolation')),
  is_compound boolean not null default false,
  is_custom boolean not null default false,
  default_rest_seconds int not null default 120 check (default_rest_seconds between 0 and 900),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index exercises_global_name_uq on public.exercises (lower(name)) where user_id is null;
create unique index exercises_user_name_uq on public.exercises (user_id, lower(name)) where user_id is not null and deleted_at is null;
create index exercises_user_updated_idx on public.exercises (user_id, updated_at);

create table public.exercise_muscles (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  muscle_id text not null references public.muscles (id),
  user_id uuid references auth.users (id) on delete cascade, -- NULL for seeded mappings
  weight numeric(3, 2) not null check (weight > 0 and weight <= 1),
  updated_at timestamptz not null default now(),
  primary key (exercise_id, muscle_id)
);
create index exercise_muscles_user_updated_idx on public.exercise_muscles (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- Profile & targets
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade, -- = id; kept for uniform RLS/sync
  display_name text,
  goal text check (goal in ('hypertrophy', 'strength', 'general', 'fat_loss')),
  experience_level text check (experience_level in ('beginner', 'intermediate', 'advanced')),
  bodyweight_kg numeric(5, 2),
  protein_g_per_kg numeric(3, 2) not null default 1.8,
  timezone text not null default 'Europe/London',
  quiet_start time,
  quiet_end time,
  notifications_paused_until timestamptz,
  units text not null default 'kg' check (units in ('kg', 'lb')),
  settings jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.muscle_targets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  muscle_id text not null references public.muscles (id),
  min_sets numeric(4, 1) not null default 10,
  max_sets numeric(4, 1) not null default 20,
  priority boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, muscle_id),
  check (min_sets <= max_sets)
);

-- ---------------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  goal text,
  notes text,
  is_active boolean not null default false,
  schedule_mode text not null default 'weekday' check (schedule_mode in ('weekday', 'rotation')),
  block_weeks int check (block_weeks between 1 and 26),
  deload_week int check (deload_week between 1 and 26),
  block_start_date date,
  rotation_anchor_date date,       -- rotation index 0 falls on this date
  current_version int not null default 1,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index plans_one_active_uq on public.plans (user_id) where is_active and deleted_at is null;
create index plans_user_updated_idx on public.plans (user_id, updated_at);

create table public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete cascade,
  version int not null,
  snapshot_json jsonb not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (plan_id, version)
);
create index plan_versions_user_updated_idx on public.plan_versions (user_id, updated_at);

create table public.plan_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete cascade,
  name text not null,
  colour text,
  emoji text,
  notes text,
  warmup_notes text,
  est_minutes int,
  "order" int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index plan_sessions_plan_idx on public.plan_sessions (plan_id);
create index plan_sessions_user_updated_idx on public.plan_sessions (user_id, updated_at);

create table public.plan_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete cascade,
  plan_session_id uuid references public.plan_sessions (id) on delete cascade, -- NULL = rest day (rotation)
  weekday int check (weekday between 1 and 7),          -- ISO: 1 = Monday
  rotation_index int check (rotation_index >= 0),
  planned_time time,
  tz text not null default 'Europe/London',
  week_of_block int check (week_of_block between 1 and 26), -- NULL = every week
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((weekday is not null) <> (rotation_index is not null))
);
create index plan_schedule_plan_idx on public.plan_schedule (plan_id);
create index plan_schedule_user_updated_idx on public.plan_schedule (user_id, updated_at);

create table public.plan_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_session_id uuid not null references public.plan_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  "order" int not null default 0,
  group_id uuid,
  group_type text check (group_type in ('superset', 'circuit', 'giant')),
  rest_seconds int check (rest_seconds between 0 and 900),
  tempo text,
  notes text,
  progression_rule text not null default 'double'
    check (progression_rule in ('double', 'linear', 'fixed_pct', 'rpe', 'none')),
  progression_config jsonb not null default '{}'::jsonb,
  alternatives uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((group_id is null) = (group_type is null))
);
create index plan_exercises_session_idx on public.plan_exercises (plan_session_id);
create index plan_exercises_user_updated_idx on public.plan_exercises (user_id, updated_at);

create table public.plan_set_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_exercise_id uuid not null references public.plan_exercises (id) on delete cascade,
  "order" int not null default 0,
  set_type text not null default 'working' check (set_type in ('warmup', 'working', 'drop', 'failure')),
  reps_min int check (reps_min >= 0),
  reps_max int check (reps_max >= 0),
  weight_kg numeric(6, 2),
  pct_e1rm numeric(5, 2) check (pct_e1rm > 0 and pct_e1rm <= 120),
  target_rpe numeric(3, 1) check (target_rpe between 1 and 10),
  target_rir int check (target_rir between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (reps_min is null or reps_max is null or reps_min <= reps_max)
);
create index plan_set_targets_exercise_idx on public.plan_set_targets (plan_exercise_id);
create index plan_set_targets_user_updated_idx on public.plan_set_targets (user_id, updated_at);

create table public.plan_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete cascade,
  version int not null,
  source text not null default 'planned' check (source in ('planned', 'actual')),
  score int not null check (score between 0 and 100),
  subscores_json jsonb not null,
  gaps_json jsonb not null default '[]'::jsonb,
  fixes_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index plan_ratings_user_updated_idx on public.plan_ratings (user_id, updated_at);

create table public.plan_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete cascade,
  kind text not null,              -- 'progression' | 'stall' | 'deload' | 'rebalance' | 'missed' | 'manual' | ...
  proposed_at timestamptz not null default now(),
  resolved_at timestamptz,
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected', 'applied')),
  summary text not null,
  diff_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index plan_changes_user_updated_idx on public.plan_changes (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- Logging
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid references public.plans (id) on delete set null,
  plan_session_id uuid references public.plan_sessions (id) on delete set null,
  name text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index sessions_user_started_idx on public.sessions (user_id, started_at desc);
create index sessions_user_updated_idx on public.sessions (user_id, updated_at);

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  plan_exercise_id uuid references public.plan_exercises (id) on delete set null,
  "order" int not null default 0,
  group_id uuid,
  group_type text check (group_type in ('superset', 'circuit', 'giant')),
  rest_seconds int check (rest_seconds between 0 and 900),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index session_exercises_session_idx on public.session_exercises (session_id);
create index session_exercises_user_updated_idx on public.session_exercises (user_id, updated_at);

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  session_exercise_id uuid references public.session_exercises (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  plan_set_target_id uuid references public.plan_set_targets (id) on delete set null,
  "order" int not null default 0,
  weight_kg numeric(6, 2) not null default 0 check (weight_kg >= 0),
  reps int not null check (reps >= 0),
  rpe numeric(3, 1) check (rpe between 1 and 10),
  rir int check (rir between 0 and 10),
  set_type text not null default 'working' check (set_type in ('warmup', 'working', 'drop', 'failure')),
  is_pr boolean not null default false,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index sets_user_exercise_idx on public.sets (user_id, exercise_id, completed_at desc);
create index sets_session_idx on public.sets (session_id);
create index sets_user_updated_idx on public.sets (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- Reports, nutrition, bodyweight
-- ---------------------------------------------------------------------------
create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  iso_week text not null,          -- e.g. '2026-W44'
  stats_json jsonb not null,
  recommendations_json jsonb not null default '[]'::jsonb,
  summary_text text,
  llm_summary_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, iso_week)
);
create index weekly_reports_user_updated_idx on public.weekly_reports (user_id, updated_at);

create table public.protein_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  grams numeric(6, 1) not null check (grams > 0),
  label text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index protein_logs_user_date_idx on public.protein_logs (user_id, date);
create index protein_logs_user_updated_idx on public.protein_logs (user_id, updated_at);

create table public.bodyweight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  kg numeric(5, 2) not null check (kg > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index bodyweight_logs_user_date_uq on public.bodyweight_logs (user_id, date) where deleted_at is null;
create index bodyweight_logs_user_updated_idx on public.bodyweight_logs (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- Push & notifications
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  deleted_at timestamptz
);

create table public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in
    ('gym', 'log_session', 'protein', 'missed_workout', 'weekly_rundown', 'celebration', 'bodyweight', 'plan_proposal')),
  enabled boolean not null default false,
  timing_mode text not null default 'fixed' check (timing_mode in ('fixed', 'per_weekday', 'relative_to_session')),
  times_json jsonb not null default '{}'::jsonb,
  weekdays int[] not null default '{1,2,3,4,5,6,7}',
  tz text not null default 'Europe/London',
  conditions_json jsonb not null default '{}'::jsonb,
  followups_json jsonb not null default '{}'::jsonb,
  tone text not null default 'motivational' check (tone in ('chill', 'motivational', 'drill')),
  custom_messages text[] not null default '{}',
  paused_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, type)
);
create index notification_rules_user_updated_idx on public.notification_rules (user_id, updated_at);

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  idempotency_key text not null unique, -- e.g. 'gym:<rule_id>:2026-10-29:0'
  payload jsonb,
  sent_at timestamptz not null default now(),
  status text not null check (status in ('sent', 'skipped', 'failed')),
  error text
);
create index notification_log_user_sent_idx on public.notification_log (user_id, sent_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'exercises', 'exercise_muscles', 'profiles', 'muscle_targets', 'plans', 'plan_versions',
    'plan_sessions', 'plan_schedule', 'plan_exercises', 'plan_set_targets', 'plan_ratings',
    'plan_changes', 'sessions', 'session_exercises', 'sets', 'weekly_reports', 'protein_logs',
    'bodyweight_logs', 'push_subscriptions', 'notification_rules'
  ]
  loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.muscles enable row level security;
create policy muscles_read on public.muscles for select to authenticated using (true);

-- Exercises & mappings: read seeded + own; write own only.
alter table public.exercises enable row level security;
create policy exercises_read on public.exercises for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy exercises_insert on public.exercises for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy exercises_update on public.exercises for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy exercises_delete on public.exercises for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.exercise_muscles enable row level security;
create policy exercise_muscles_read on public.exercise_muscles for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy exercise_muscles_insert on public.exercise_muscles for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.exercises e where e.id = exercise_id and e.user_id = (select auth.uid()))
  );
create policy exercise_muscles_update on public.exercise_muscles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy exercise_muscles_delete on public.exercise_muscles for delete to authenticated
  using (user_id = (select auth.uid()));

-- Plain user-owned tables: full CRUD on own rows.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'muscle_targets', 'plans', 'plan_versions', 'plan_sessions', 'plan_schedule',
    'plan_exercises', 'plan_set_targets', 'plan_ratings', 'plan_changes', 'sessions',
    'session_exercises', 'sets', 'weekly_reports', 'protein_logs', 'bodyweight_logs',
    'push_subscriptions', 'notification_rules'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_owner', t);
  end loop;
end;
$$;

-- notification_log: written only by the service role (Edge Functions); users may read their own.
alter table public.notification_log enable row level security;
create policy notification_log_read on public.notification_log for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- New user bootstrap: profile + default muscle targets
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, user_id) values (new.id, new.id)
  on conflict (id) do nothing;

  insert into public.muscle_targets (user_id, muscle_id, min_sets, max_sets)
  select new.id, m.id, 10, 20 from public.muscles m
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
