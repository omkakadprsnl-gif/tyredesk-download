-- Each Supabase project has one owner-protected TyreDesk shop.
-- Legacy stock is left intact. The uniqueness rule applies to structured stock.
create unique index if not exists tyredesk_inventory_identity
  on tyredesk.records ((doc->>'inventoryMode'), ((doc->>'tyreIdentity')::jsonb))
  where kind = 'catalog' and doc->>'type' = 'tyre' and doc ? 'tyreIdentity';

create or replace function tyredesk.guard_inventory_identity()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare selected_mode text; tyre_mode text; identity jsonb;
begin
  if new.kind = 'settings' and new.key = 'shop' then
    selected_mode := new.doc->>'inventoryMode';
    if selected_mode is not null and selected_mode not in ('simple','detailed') then
      raise exception 'Invalid inventory mode';
    end if;
    if tg_op = 'UPDATE' then
      if coalesce(old.doc->>'inventoryMode','detailed') is distinct from selected_mode
        and exists (select from tyredesk.records
          where kind = 'catalog' and doc->>'type' = 'tyre' and revision < new.revision) then
        if selected_mode is not null or old.doc ? 'inventoryMode' then
          raise exception 'Inventory mode is locked after stock is created';
        end if;
      end if;
    end if;
    if exists (select from tyredesk.records where kind = 'catalog' and doc ? 'tyreIdentity'
       and (doc->>'inventoryMode') is distinct from selected_mode) then
      raise exception 'Shared stock has a different inventory mode';
    end if;
  elsif new.kind = 'catalog' and new.doc ? 'tyreIdentity' then
    select doc->>'inventoryMode' into selected_mode from tyredesk.records
      where kind = 'settings' and key = 'shop';
    tyre_mode := new.doc->>'inventoryMode';
    identity := (new.doc->>'tyreIdentity')::jsonb;
    if tyre_mode is null or tyre_mode not in ('simple','detailed') or tyre_mode is distinct from selected_mode
       or new.doc->>'type' is distinct from 'tyre'
       or nullif(btrim(new.doc->>'brand'),'') is null
       or jsonb_typeof(identity) is distinct from 'array' then
      raise exception 'Invalid shared stock identity';
    end if;
    if (tyre_mode = 'simple' and (jsonb_array_length(identity) <> 1 or
        coalesce(new.doc->>'size','') <> '' or coalesce(new.doc->>'model','') <> ''))
       or (tyre_mode = 'detailed' and (jsonb_array_length(identity) <> 3 or
        nullif(btrim(new.doc->>'model'),'') is null or nullif(btrim(new.doc->>'size'),'') is null)) then
      raise exception 'Invalid shared stock identity';
    end if;
    if tg_op = 'UPDATE' and old.doc ? 'tyreIdentity' and
      (old.doc->>'tyreIdentity' <> new.doc->>'tyreIdentity' or old.doc->>'inventoryMode' <> tyre_mode) then
      raise exception 'A shared stock identity cannot be reassigned';
    end if;
  end if;
  return new;
end
$$;
revoke all on function tyredesk.guard_inventory_identity() from public, anon;
grant execute on function tyredesk.guard_inventory_identity() to authenticated;

drop trigger if exists tyredesk_guard_inventory_identity on tyredesk.records;
create constraint trigger tyredesk_guard_inventory_identity
  after insert or update on tyredesk.records initially deferred deferrable
  for each row when (new.kind in ('settings','catalog'))
  execute function tyredesk.guard_inventory_identity();

-- Retain a single administrative usage snapshot. The live app's head RPC
-- continues to return current database bytes. No shop records are removed.
create table if not exists tyredesk.storage_usage (
  singleton boolean primary key default true check (singleton),
  checked_at timestamptz not null,
  database_bytes bigint not null,
  uploaded_bytes bigint,
  database_warning smallint not null check (database_warning in (0,70,85))
);
alter table tyredesk.storage_usage enable row level security;
revoke all on tyredesk.storage_usage from public, anon, authenticated;

create or replace function tyredesk.measure_storage()
returns void language plpgsql security invoker set search_path = ''
as $$
declare db_bytes bigint; file_bytes bigint;
begin
  db_bytes := pg_database_size(current_database());
  select case when count(*) filter (where coalesce(metadata->>'size','') !~ '^[0-9]+$') = 0
       then coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint end),0)::bigint
       else null end
    into file_bytes from storage.objects;
  insert into tyredesk.storage_usage(singleton,checked_at,database_bytes,uploaded_bytes,database_warning)
  values(true,clock_timestamp(),db_bytes,file_bytes,
    case when db_bytes >= 445644800 then 85 when db_bytes >= 367001600 then 70 else 0 end)
  on conflict(singleton) do update set checked_at=excluded.checked_at,database_bytes=excluded.database_bytes,
    uploaded_bytes=excluded.uploaded_bytes,database_warning=excluded.database_warning;
end
$$;
revoke all on function tyredesk.measure_storage() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('tyredesk-weekly-storage-check', '0 3 * * 1', $job$
  select tyredesk.measure_storage();
  delete from cron.job_run_details where end_time < now() - interval '30 days'
    and status = 'succeeded' and jobid = (select jobid from cron.job where jobname = 'tyredesk-weekly-storage-check');
$job$);
select tyredesk.measure_storage();
notify pgrst, 'reload schema';

