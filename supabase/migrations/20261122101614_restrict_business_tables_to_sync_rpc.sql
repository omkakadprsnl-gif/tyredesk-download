-- Install after cloud/setup.sql, cloud/receipts.sql and the inventory migration.
-- Preserve existing RPC signatures and records. Business writes go through the revision protocol.
create role tyredesk_rpc nologin noinherit nobypassrls;
grant tyredesk_rpc to postgres;
grant usage, create on schema tyredesk to tyredesk_rpc;
grant usage on schema auth to tyredesk_rpc;
grant execute on function auth.uid() to tyredesk_rpc;

alter policy owner_shop on tyredesk.shop to tyredesk_rpc;
alter policy owner_records on tyredesk.records to tyredesk_rpc;
alter policy owner_devices on tyredesk.devices to tyredesk_rpc;

grant select, update(revision,last_delete) on tyredesk.shop to tyredesk_rpc;
grant select, insert, update, delete on tyredesk.records to tyredesk_rpc;
grant select, insert, update(last_token,last_revision) on tyredesk.devices to tyredesk_rpc;
grant execute on function tyredesk.tyredesk_commit(bigint,jsonb) to tyredesk_rpc;
revoke execute on function tyredesk.tyredesk_commit(bigint,jsonb) from public, anon, authenticated;

-- A deferred trigger still needs its shop-scoped read policy at commit time.
alter function tyredesk.guard_inventory_identity() security definer;
alter function tyredesk.guard_inventory_identity() owner to tyredesk_rpc;
revoke all on function tyredesk.guard_inventory_identity() from public, anon, authenticated;

alter function public.tyredesk_head() set schema tyredesk;
alter function tyredesk.tyredesk_head() security definer;
alter function tyredesk.tyredesk_head() owner to tyredesk_rpc;
revoke all on function tyredesk.tyredesk_head() from public, anon;
grant execute on function tyredesk.tyredesk_head() to authenticated;

create function public.tyredesk_head() returns jsonb
language sql security invoker set search_path='' as $$
  select tyredesk.tyredesk_head();
$$;
revoke all on function public.tyredesk_head() from public, anon;
grant execute on function public.tyredesk_head() to authenticated;

alter function public.tyredesk_device(uuid) set schema tyredesk;
alter function tyredesk.tyredesk_device(uuid) security definer;
alter function tyredesk.tyredesk_device(uuid) owner to tyredesk_rpc;
revoke all on function tyredesk.tyredesk_device(uuid) from public, anon;
grant execute on function tyredesk.tyredesk_device(uuid) to authenticated;

create function public.tyredesk_device(token uuid) returns integer
language sql security invoker set search_path='' as $$
  select tyredesk.tyredesk_device($1);
$$;
revoke all on function public.tyredesk_device(uuid) from public, anon;
grant execute on function public.tyredesk_device(uuid) to authenticated;

alter function public.tyredesk_page(bigint,text,text) set schema tyredesk;
alter function tyredesk.tyredesk_page(bigint,text,text) security definer;
alter function tyredesk.tyredesk_page(bigint,text,text) owner to tyredesk_rpc;
revoke all on function tyredesk.tyredesk_page(bigint,text,text) from public, anon;
grant execute on function tyredesk.tyredesk_page(bigint,text,text) to authenticated;

create function public.tyredesk_page(since_revision bigint, after_kind text, after_key text) returns table(kind text,key text,doc jsonb)
language sql security invoker set search_path='' as $$
  select * from tyredesk.tyredesk_page($1,$2,$3);
$$;
revoke all on function public.tyredesk_page(bigint,text,text) from public, anon;
grant execute on function public.tyredesk_page(bigint,text,text) to authenticated;

alter function public.tyredesk_receipt(uuid,uuid) set schema tyredesk;
alter function tyredesk.tyredesk_receipt(uuid,uuid) security definer;
alter function tyredesk.tyredesk_receipt(uuid,uuid) owner to tyredesk_rpc;
revoke all on function tyredesk.tyredesk_receipt(uuid,uuid) from public, anon;
grant execute on function tyredesk.tyredesk_receipt(uuid,uuid) to authenticated;

create function public.tyredesk_receipt(device_token uuid, write_token uuid) returns bigint
language sql security invoker set search_path='' as $$
  select tyredesk.tyredesk_receipt($1,$2);
$$;
revoke all on function public.tyredesk_receipt(uuid,uuid) from public, anon;
grant execute on function public.tyredesk_receipt(uuid,uuid) to authenticated;

alter function public.tyredesk_commit(bigint,jsonb,uuid,uuid) set schema tyredesk;
alter function tyredesk.tyredesk_commit(bigint,jsonb,uuid,uuid) security definer;
alter function tyredesk.tyredesk_commit(bigint,jsonb,uuid,uuid) owner to tyredesk_rpc;
revoke all on function tyredesk.tyredesk_commit(bigint,jsonb,uuid,uuid) from public, anon;
grant execute on function tyredesk.tyredesk_commit(bigint,jsonb,uuid,uuid) to authenticated;

create function public.tyredesk_commit(expected_revision bigint, changes jsonb, device_token uuid, write_token uuid) returns bigint
language sql security invoker set search_path='' as $$
  select tyredesk.tyredesk_commit($1,$2,$3,$4);
$$;
revoke all on function public.tyredesk_commit(bigint,jsonb,uuid,uuid) from public, anon;
grant execute on function public.tyredesk_commit(bigint,jsonb,uuid,uuid) to authenticated;

revoke all on tyredesk.records, tyredesk.devices, tyredesk.shop from public, anon, authenticated;
revoke update(revision,last_delete) on tyredesk.shop from authenticated;
revoke update(last_token,last_revision) on tyredesk.devices from authenticated;
revoke create on schema tyredesk from tyredesk_rpc;
revoke tyredesk_rpc from postgres;
notify pgrst,'reload schema';

