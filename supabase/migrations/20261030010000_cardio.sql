-- Cardio entries logged inside a workout. Kept separate from sets: no muscle volume, no PRs.
create table public.cardio_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  activity text not null check (activity in
    ('run', 'walk', 'cycle', 'row', 'elliptical', 'stairs', 'swim', 'hiit', 'other')),
  duration_seconds int not null check (duration_seconds > 0 and duration_seconds <= 86400),
  calories int check (calories >= 0 and calories <= 10000),
  distance_km numeric(6, 2) check (distance_km >= 0),
  avg_hr int check (avg_hr between 30 and 250),
  notes text,
  "order" int not null default 0,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index cardio_entries_session_idx on public.cardio_entries (session_id);
create index cardio_entries_user_updated_idx on public.cardio_entries (user_id, updated_at);

create trigger cardio_entries_set_updated_at
  before insert or update on public.cardio_entries
  for each row execute function public.set_updated_at();

alter table public.cardio_entries enable row level security;
create policy cardio_entries_owner on public.cardio_entries for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
