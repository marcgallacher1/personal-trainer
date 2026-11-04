-- Cardio in a plan workout, e.g. [{"activity": "run", "minutes": 20}]. Logged as cardio_entries.
alter table public.plan_sessions
  add column cardio_json jsonb not null default '[]'
  check (jsonb_typeof(cardio_json) = 'array' and jsonb_array_length(cardio_json) <= 10);
