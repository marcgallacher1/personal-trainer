-- RLS: each user sees only their own rows, plus the seeded (global) catalogue.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Two users. The signup trigger should create profiles + default muscle targets.
insert into auth.users (id, email, instance_id, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

select is((select count(*)::int from public.profiles where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')), 2, 'signup trigger creates a profile per user');
select is((select count(*)::int from public.muscle_targets where user_id = '11111111-1111-1111-1111-111111111111'), 17, 'signup trigger seeds 17 muscle targets');
select is((select count(*)::int from public.notification_rules where user_id = '11111111-1111-1111-1111-111111111111'), 8, 'signup trigger seeds the 8 notification rules');
select is((select quiet_start::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'), '22:00:00', 'quiet hours default to 22:00-07:00');

-- The same reminder key can be used by two users, but only once each
insert into public.notification_log (user_id, type, idempotency_key, status) values
  ('11111111-1111-1111-1111-111111111111', 'gym', 'gym:2026-11-02:15:00', 'sent'),
  ('22222222-2222-2222-2222-222222222222', 'gym', 'gym:2026-11-02:15:00', 'sent');
select throws_ok(
  $$ insert into public.notification_log (user_id, type, idempotency_key, status)
     values ('11111111-1111-1111-1111-111111111111', 'gym', 'gym:2026-11-02:15:00', 'sent') $$,
  '23505', null, 'a reminder is never logged twice for the same user');

-- Sign-up is invite-only (seed.sql invites %@test.local)
select throws_ok(
  $$ insert into auth.users (id, email, instance_id, aud, role)
     values ('33333333-3333-3333-3333-333333333333', 'stranger@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated') $$,
  'P0001', 'not_invited', 'an email that is not invited cannot sign up');

-- Act as user A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.sessions (id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'A session');
insert into public.exercises (id, user_id, name, equipment, pattern, is_custom)
values ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'A Custom Curl', 'cable', 'isolation', true);

select is((select user_id from public.sessions where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'user_id defaults to auth.uid()');
select cmp_ok((select count(*)::int from public.exercises where user_id is null), '>=', 115, 'A can read the seeded catalogue');
select cmp_ok((select count(*)::int from public.exercise_muscles), '>', 0, 'A can read seeded muscle mappings');
select is((select count(*)::int from public.muscles), 17, 'A can read muscles');

-- A cannot modify seeded exercises.
update public.exercises set name = 'Hacked' where user_id is null;
select is((select count(*)::int from public.exercises where name = 'Hacked'), 0, 'A cannot edit seeded exercises');

-- A cannot write rows owned by B.
select throws_ok(
  $$ insert into public.sessions (user_id, name) values ('22222222-2222-2222-2222-222222222222', 'spoof') $$,
  '42501', null, 'A cannot insert rows for B');

-- Act as user B.
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is((select count(*)::int from public.sessions), 0, 'B cannot see A''s sessions');
select is((select count(*)::int from public.exercises where is_custom), 0, 'B cannot see A''s custom exercises');
select is((select count(*)::int from public.profiles), 1, 'B sees only their own profile');

-- Nobody can write the notification log from the client.
select throws_ok(
  $$ insert into public.notification_log (user_id, type, idempotency_key, status)
     values ('22222222-2222-2222-2222-222222222222', 'gym', 'x', 'sent') $$,
  '42501', null, 'clients cannot write notification_log');

-- Server-only functions can't be called from the app
-- Checked as a privilege, not by calling them: on GitHub's runners calling them crashed the test server
select ok(not has_function_privilege('authenticated', 'public.configure_notify(text, text)', 'execute'), 'clients cannot configure the cron secret');
select ok(not has_function_privilege('authenticated', 'public.run_notify()', 'execute'), 'clients cannot trigger notify');

select throws_ok($$ select * from public.invites $$, '42501', null, 'clients cannot read the invite list');

select * from finish();
rollback;
