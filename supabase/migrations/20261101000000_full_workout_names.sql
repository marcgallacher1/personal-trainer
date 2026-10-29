-- Workouts in a plan now carry their full name ("Push A"), not just a version letter ("A").
-- Fix rows created while plans briefly meant "one workout type with versions".
update public.plan_sessions ps
set name = p.name || ' ' || ps.name
from public.plans p
where p.id = ps.plan_id
  and ps.name ~ '^[A-Z]$';
