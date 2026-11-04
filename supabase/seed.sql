-- Local-dev-only seed (runs on `supabase db reset`, never on hosted).
-- Reference data (muscles, exercise catalogue) lives in migrations so it reaches the hosted DB.
-- Dev fixtures (12 weeks of fake training history) are added in a later phase.

-- Local test accounts (integration and pgTAP tests) are always invited
insert into public.invites (email, note) values ('%@test.local', 'local tests') on conflict do nothing;
