-- Correct the singleton shop UPDATE statements in the billing handover functions.
-- Earlier handover migration omitted WHERE, which fails on Supabase projects
-- enforcing safe updates ("UPDATE requires a WHERE clause").
-- Recreate as the original RPC-owning role without exposing extra privileges.
grant tyredesk_rpc to postgres;
grant create on schema tyredesk to tyredesk_rpc;
set role tyredesk_rpc;

create or replace function tyredesk.tyredesk_billing_claim(device_token uuid, grant_token uuid, expected_revision bigint)
returns text language plpgsql security definer set search_path='' as $$
declare slot tyredesk.shop%rowtype;
begin
  select * into strict slot from tyredesk.shop where singleton for update;
  if grant_token is null or not exists(select 1 from tyredesk.devices where device=device_token)
    then raise exception 'Register this device first'; end if;
  if slot.billing_device is not null then
    if slot.billing_device=device_token and slot.billing_token=grant_token then return 'own'; end if;
    return 'busy';
  end if;
  if slot.revision is distinct from expected_revision then return 'stale'; end if;
  if not exists(select 1 from tyredesk.records where kind='settings' and key='shop') then
    raise exception 'Set up your shop before starting billing';
  end if;
  update tyredesk.shop set billing_device=device_token,billing_token=grant_token where singleton;
  return 'own';
end $$;

create or replace function tyredesk.tyredesk_billing_release(device_token uuid, grant_token uuid, expected_revision bigint)
returns text language plpgsql security definer set search_path='' as $$
declare slot tyredesk.shop%rowtype;
begin
  select * into strict slot from tyredesk.shop where singleton for update;
  if slot.billing_device is distinct from device_token or slot.billing_token is distinct from grant_token
    or grant_token is null then return 'released'; end if;
  if slot.revision is distinct from expected_revision then return 'stale'; end if;
  -- Increment the shared revision to invalidate delayed claim requests.
  update tyredesk.shop set billing_device=null,billing_token=null,revision=revision+1 where singleton;
  return 'released';
end $$;

reset role;
revoke create on schema tyredesk from tyredesk_rpc;
revoke tyredesk_rpc from postgres;
