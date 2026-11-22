-- Existing duplicates must be reconciled by the shop before rollout.
-- Never remove or rewrite historical receipts in this migration.
create unique index unique_shop_upi_transfer on tyredesk.records
  (lower(btrim(doc->>'reference')))
  where kind='payments' and doc->>'type'='received' and doc->>'method'='upi'
    and btrim(doc->>'reference')<>'';

alter table tyredesk.devices add column retired_at timestamptz;

grant tyredesk_rpc to postgres;
grant create on schema tyredesk to tyredesk_rpc;
set role tyredesk_rpc;

create or replace function tyredesk.tyredesk_billing_status(device_token uuid, grant_token uuid)
returns text language sql stable security definer set search_path='' as $$
  select case
    when exists (select 1 from tyredesk.devices where device=device_token and retired_at is not null)
      then 'retired'
    when billing_device is null then 'free'
    when billing_device=device_token and billing_token=grant_token then 'own'
    else 'busy' end
  from tyredesk.shop where singleton;
$$;

create function tyredesk.guard_retired_billing_device() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.billing_device is not null and exists (
    select 1 from tyredesk.devices where device=new.billing_device and retired_at is not null
  ) then raise exception 'This billing device has been retired'; end if;
  return new;
end $$;
revoke all on function tyredesk.guard_retired_billing_device() from public, anon, authenticated;

reset role;
create trigger guard_retired_billing_device before update of billing_device on tyredesk.shop
for each row execute function tyredesk.guard_retired_billing_device();

-- Only a shop project administrator can do this from its SQL editor.
-- Lock ordering matches billing claim, release and commit.
create function tyredesk.retire_lost_billing_device(expected_device uuid, expected_revision bigint)
returns text language plpgsql security invoker set search_path='' as $$
declare slot tyredesk.shop%rowtype;
begin
  select * into strict slot from tyredesk.shop where singleton for update;
  if expected_device is null or slot.billing_device is distinct from expected_device
    or slot.revision is distinct from expected_revision then return 'stale'; end if;
  update tyredesk.devices set retired_at=clock_timestamp() where device=expected_device;
  update tyredesk.shop set billing_device=null,billing_token=null,revision=revision+1 where singleton;
  return 'retired';
end $$;
revoke all on function tyredesk.retire_lost_billing_device(uuid,bigint) from public, anon, authenticated;
grant execute on function tyredesk.retire_lost_billing_device(uuid,bigint) to postgres;
revoke create on schema tyredesk from tyredesk_rpc;
revoke tyredesk_rpc from postgres;
notify pgrst,'reload schema';
