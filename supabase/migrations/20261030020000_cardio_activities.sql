-- Wider cardio activity list (gym machines and classes). Existing values remain valid.
alter table public.cardio_entries drop constraint cardio_entries_activity_check;
alter table public.cardio_entries add constraint cardio_entries_activity_check check (activity in (
  'run', 'walk', 'cycle', 'swim', 'other',
  'stairs', 'ski_erg', 'exercise_bike', 'air_bike', 'elliptical', 'row',
  'spin', 'hiit', 'sled', 'battle_ropes', 'skipping', 'boxing', 'hike'
));
