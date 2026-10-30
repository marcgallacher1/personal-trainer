-- Clear the plans made while the plan feature was being reshaped, so the user starts fresh with
-- "Start new plan" (requested 2026-11-01). Soft deletes, so devices pick the change up on sync.
-- Logged workouts are untouched (they keep their history; plan links are informational).
update public.plan_set_targets set deleted_at = now() where deleted_at is null;
update public.plan_exercises set deleted_at = now() where deleted_at is null;
update public.plan_schedule set deleted_at = now() where deleted_at is null;
update public.plan_sessions set deleted_at = now() where deleted_at is null;
update public.plan_versions set deleted_at = now() where deleted_at is null;
update public.plans set deleted_at = now(), is_active = false where deleted_at is null;
