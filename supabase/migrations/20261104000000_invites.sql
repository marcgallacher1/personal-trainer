-- Invite-only sign-up: an account can only be created for an email on this list.
-- Add someone (SQL editor, as the project owner):
--   insert into public.invites (email) values ('friend@example.com');
-- `email` is matched with LIKE, so '%@example.com' invites a whole domain.
create table public.invites (
  email text primary key check (email = lower(email)),
  note text,
  created_at timestamptz not null default now()
);

-- RLS on with no policies: the app can't read or change the list, only the owner can.
alter table public.invites enable row level security;
revoke all on public.invites from anon, authenticated;

create or replace function public.check_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.invites i where lower(new.email) like i.email) then
    raise exception 'not_invited' using hint = 'This email has not been invited';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_invite() from public, anon, authenticated;

create trigger check_invite_before_signup
  before insert on auth.users
  for each row execute function public.check_invite();
