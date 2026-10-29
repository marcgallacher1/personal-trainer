-- Goals: body composition goal + weekly workout target (training focus reuses profiles.goal).
alter table public.profiles
  add column body_goal text check (body_goal in ('bulk', 'lean_bulk', 'maintain', 'cut')),
  add column sessions_per_week int not null default 4 check (sessions_per_week between 1 and 14);

-- Muscles deliberately not trained right now (e.g. legs while bringing up upper body).
alter table public.muscle_targets add column paused boolean not null default false;

-- Plan targets for timed exercises (holds, carries).
alter table public.plan_set_targets
  add column seconds_min int check (seconds_min >= 0),
  add column seconds_max int check (seconds_max >= 0);
