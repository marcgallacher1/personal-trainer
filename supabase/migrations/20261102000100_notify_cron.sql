-- Every 5 minutes, call the `notify` Edge Function.
-- Needs two Vault secrets (see README): notify_url and notify_secret. Does nothing until they exist.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.run_notify()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret');
begin
  if url is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function public.run_notify() from public, anon, authenticated;

select cron.schedule('notify', '*/5 * * * *', 'select public.run_notify()');

-- Sets the two Vault secrets above. Server-only (service role).
create or replace function public.configure_notify(url text, secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'notify_url';
  if v_id is null then
    perform vault.create_secret(url, 'notify_url');
  else
    perform vault.update_secret(v_id, url);
  end if;
  select id into v_id from vault.secrets where name = 'notify_secret';
  if v_id is null then
    perform vault.create_secret(secret, 'notify_secret');
  else
    perform vault.update_secret(v_id, secret);
  end if;
end;
$$;

revoke execute on function public.configure_notify(text, text) from public, anon, authenticated;
grant execute on function public.configure_notify(text, text) to service_role;
