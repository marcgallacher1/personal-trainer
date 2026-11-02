-- Phase 4: notification settings and the user's chosen defaults.

-- A date you're training for (e.g. a holiday), used in reminder messages.
alter table public.profiles
  add column goal_event_name text,
  add column goal_event_date date;

-- Each user's reminders are only ever sent once (keys are per user).
alter table public.notification_log drop constraint notification_log_idempotency_key_key;
alter table public.notification_log add constraint notification_log_user_key_uq unique (user_id, idempotency_key);

-- 'mix' = motivational and drill sergeant combined.
alter table public.notification_rules drop constraint notification_rules_tone_check;
alter table public.notification_rules add constraint notification_rules_tone_check
  check (tone in ('chill', 'motivational', 'drill', 'mix'));

-- The defaults chosen when Phase 4 was planned. All editable in Settings.
create or replace function public.seed_notification_rules(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notification_rules
    (user_id, type, enabled, timing_mode, times_json, weekdays, conditions_json, followups_json, tone)
  values
    (uid, 'gym', true, 'per_weekday',
      '{"times": ["15:00", "17:30"], "byWeekday": {"6": ["10:00"], "7": ["13:00"]}}',
      '{1,2,3,4,5,6,7}', '{"days": "plan", "skipIfLogged": true}', '{"times": ["19:30"]}', 'mix'),
    (uid, 'log_session', true, 'relative_to_session', '{"afterStartMinutes": 120}',
      '{1,2,3,4,5,6,7}', '{}', '{}', 'mix'),
    (uid, 'missed_workout', true, 'fixed', '{"times": ["20:00"]}',
      '{1,2,3,4,5,6,7}', '{"days": "plan", "suggestReschedule": true}', '{}', 'mix'),
    (uid, 'weekly_rundown', true, 'fixed', '{"times": ["19:00"]}',
      '{7}', '{"days": "custom"}', '{}', 'mix'),
    (uid, 'protein', true, 'fixed', '{"times": ["14:00", "20:00"]}',
      '{1,2,3,4,5,6,7}', '{"days": "all", "onlyIfBehind": false, "showRemaining": true}', '{}', 'mix'),
    (uid, 'bodyweight', true, 'fixed', '{"times": ["07:30"]}',
      '{1}', '{"days": "custom", "skipIfLogged": true}', '{"times": ["21:00"]}', 'mix'),
    (uid, 'celebration', true, 'fixed', '{"times": ["09:00"]}',
      '{1,2,3,4,5,6,7}', '{"pbs": true, "streaks": true, "countdown": true}', '{}', 'mix'),
    (uid, 'plan_proposal', false, 'fixed', '{}',
      '{1,2,3,4,5,6,7}', '{}', '{}', 'mix')
  on conflict (user_id, type) do nothing;
$$;

-- Existing users
update public.profiles set quiet_start = '22:00', quiet_end = '07:00' where quiet_start is null;
select public.seed_notification_rules(id) from auth.users;

-- New users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, user_id, quiet_start, quiet_end)
  values (new.id, new.id, '22:00', '07:00')
  on conflict (id) do nothing;

  insert into public.muscle_targets (user_id, muscle_id, min_sets, max_sets)
  select new.id, m.id, 10, 20 from public.muscles m
  on conflict do nothing;

  perform public.seed_notification_rules(new.id);
  return new;
end;
$$;
