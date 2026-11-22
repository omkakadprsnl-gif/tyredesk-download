-- A shop can have exactly one issuing device. Its grant survives disconnection.
alter table tyredesk.shop add column billing_device uuid, add column billing_token uuid,
  add constraint billing_grant_pair check ((billing_device is null) = (billing_token is null));

grant tyredesk_rpc to postgres;
grant create on schema tyredesk to tyredesk_rpc;
grant update(billing_device,billing_token) on tyredesk.shop to tyredesk_rpc;

alter function tyredesk.tyredesk_commit(bigint,jsonb,uuid,uuid) rename to commit_with_receipt;
revoke all on function tyredesk.commit_with_receipt(bigint,jsonb,uuid,uuid) from public, anon, authenticated;

-- The pre-handover endpoint may initialize an empty shop only.
create function tyredesk.tyredesk_commit(expected_revision bigint, changes jsonb, device_token uuid, write_token uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare current_revision bigint;
begin
  select revision into strict current_revision from tyredesk.shop for update;
  if current_revision <> 0 or not coalesce(
    jsonb_array_length(changes)=1 and changes->0->>'kind'='settings' and changes->0->>'key'='shop'
    and jsonb_typeof(changes->0->'doc')='object' and changes->0->'doc'->>'id'='shop',false
  ) then raise exception 'Update TyreDesk and start billing on this device'; end if;
  return tyredesk.commit_with_receipt(expected_revision,changes,device_token,write_token);
end $$;

create function tyredesk.tyredesk_billing_status(device_token uuid, grant_token uuid)
returns text language sql stable security definer set search_path='' as $$
  select case when billing_device is null then 'free'
              when billing_device=device_token and billing_token=grant_token then 'own'
              else 'busy' end
  from tyredesk.shop;
$$;

create function tyredesk.tyredesk_billing_claim(device_token uuid, grant_token uuid, expected_revision bigint)
returns text language plpgsql security definer set search_path='' as $$
declare slot tyredesk.shop%rowtype;
begin
  select * into strict slot from tyredesk.shop for update;
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
  update tyredesk.shop set billing_device=device_token,billing_token=grant_token;
  return 'own';
end $$;

create function tyredesk.tyredesk_billing_release(device_token uuid, grant_token uuid, expected_revision bigint)
returns text language plpgsql security definer set search_path='' as $$
declare slot tyredesk.shop%rowtype;
begin
  select * into strict slot from tyredesk.shop for update;
  if slot.billing_device is distinct from device_token or slot.billing_token is distinct from grant_token
    or grant_token is null then return 'released'; end if;
  if slot.revision is distinct from expected_revision then return 'stale'; end if;
  -- Invalidate delayed claim requests from this grant, including one retried by a client.
  update tyredesk.shop set billing_device=null,billing_token=null,revision=revision+1;
  return 'released';
end $$;

create function tyredesk.tyredesk_billing_commit(expected_revision bigint, changes jsonb, device_token uuid, write_token uuid, grant_token uuid)
returns bigint language plpgsql security definer set search_path='' as $$
declare slot tyredesk.shop%rowtype;
begin
  select * into strict slot from tyredesk.shop for update;
  if grant_token is null or slot.billing_device is distinct from device_token
    or slot.billing_token is distinct from grant_token then
    raise exception 'This device does not hold billing access';
  end if;
  return tyredesk.commit_with_receipt(expected_revision,changes,device_token,write_token);
end $$;

alter function tyredesk.tyredesk_commit(bigint,jsonb,uuid,uuid) owner to tyredesk_rpc;
alter function tyredesk.tyredesk_billing_status(uuid,uuid) owner to tyredesk_rpc;
alter function tyredesk.tyredesk_billing_claim(uuid,uuid,bigint) owner to tyredesk_rpc;
alter function tyredesk.tyredesk_billing_release(uuid,uuid,bigint) owner to tyredesk_rpc;
alter function tyredesk.tyredesk_billing_commit(bigint,jsonb,uuid,uuid,uuid) owner to tyredesk_rpc;

revoke all on function tyredesk.tyredesk_commit(bigint,jsonb,uuid,uuid),
  tyredesk.tyredesk_billing_status(uuid,uuid),tyredesk.tyredesk_billing_claim(uuid,uuid,bigint),
  tyredesk.tyredesk_billing_release(uuid,uuid,bigint),tyredesk.tyredesk_billing_commit(bigint,jsonb,uuid,uuid,uuid)
  from public, anon;
grant execute on function tyredesk.tyredesk_commit(bigint,jsonb,uuid,uuid),
  tyredesk.tyredesk_billing_status(uuid,uuid),tyredesk.tyredesk_billing_claim(uuid,uuid,bigint),
  tyredesk.tyredesk_billing_release(uuid,uuid,bigint),tyredesk.tyredesk_billing_commit(bigint,jsonb,uuid,uuid,uuid)
  to authenticated;

create or replace function public.tyredesk_commit(expected_revision bigint, changes jsonb, device_token uuid, write_token uuid)
returns bigint language sql security invoker set search_path='' as $$
  select tyredesk.tyredesk_commit($1,$2,$3,$4);
$$;
create function public.tyredesk_billing_status(device_token uuid, grant_token uuid)
returns text language sql security invoker set search_path='' as $$
  select tyredesk.tyredesk_billing_status($1,$2);
$$;
create function public.tyredesk_billing_claim(device_token uuid, grant_token uuid, expected_revision bigint)
returns text language sql security invoker set search_path='' as $$
  select tyredesk.tyredesk_billing_claim($1,$2,$3);
$$;
create function public.tyredesk_billing_release(device_token uuid, grant_token uuid, expected_revision bigint)
returns text language sql security invoker set search_path='' as $$
  select tyredesk.tyredesk_billing_release($1,$2,$3);
$$;
create function public.tyredesk_billing_commit(expected_revision bigint, changes jsonb, device_token uuid, write_token uuid, grant_token uuid)
returns bigint language sql security invoker set search_path='' as $$
  select tyredesk.tyredesk_billing_commit($1,$2,$3,$4,$5);
$$;
revoke all on function public.tyredesk_billing_status(uuid,uuid),public.tyredesk_billing_claim(uuid,uuid,bigint),
  public.tyredesk_billing_release(uuid,uuid,bigint),public.tyredesk_billing_commit(bigint,jsonb,uuid,uuid,uuid) from public, anon;
grant execute on function public.tyredesk_billing_status(uuid,uuid),public.tyredesk_billing_claim(uuid,uuid,bigint),
  public.tyredesk_billing_release(uuid,uuid,bigint),public.tyredesk_billing_commit(bigint,jsonb,uuid,uuid,uuid) to authenticated;
revoke create on schema tyredesk from tyredesk_rpc;
revoke tyredesk_rpc from postgres;
notify pgrst,'reload schema';
