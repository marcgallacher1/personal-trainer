-- Custom exercise mappings can be edited offline; removals sync as soft deletes like every other table.
alter table public.exercise_muscles add column deleted_at timestamptz;
