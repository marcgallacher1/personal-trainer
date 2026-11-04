-- Optional cardio extras, e.g. {"speedKmh": 10, "inclinePct": 2} or {"poolLengthM": 25, "lengths": 40}
alter table public.cardio_entries
  add column details_json jsonb not null default '{}'
  check (jsonb_typeof(details_json) = 'object');
