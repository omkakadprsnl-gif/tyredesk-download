create schema tyredesk;
revoke all on schema tyredesk from public;
grant usage on schema tyredesk to authenticated;
create table tyredesk.shop (
  singleton boolean primary key default true check (singleton),
  owner_id uuid not null unique references auth.users(id),
  revision bigint not null default 0,
  last_delete bigint not null default 0
);
create table tyredesk.records (
  kind text not null check (kind in ('settings','customers','vehicles','catalog','orders','payments','expenses','inventoryMovements','purchases','reminders','meta')),
  key text not null,
  doc jsonb not null check (jsonb_typeof(doc)='object' and doc ? 'id' and doc->>'id'=key),
  revision bigint not null,
  primary key(kind,key)
);
create index records_changed on tyredesk.records(revision);
create unique index distinct_bill_number on tyredesk.records ((doc->>'number')) where kind='orders';
create unique index distinct_bill_request on tyredesk.records ((doc->>'requestId')) where kind='orders';
create unique index distinct_payment_reference on tyredesk.records ((doc->>'orderId'),(doc->>'method'),lower(trim(doc->>'reference'))) where kind='payments' and doc->>'type'='received' and trim(doc->>'reference')<>'';
create index payment_order on tyredesk.records ((doc->>'orderId')) where kind='payments';
create table tyredesk.devices(device uuid primary key, series integer generated always as identity unique);
alter table tyredesk.shop enable row level security;
alter table tyredesk.records enable row level security;
alter table tyredesk.devices enable row level security;
create policy owner_shop on tyredesk.shop to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy owner_records on tyredesk.records to authenticated using ((select exists(select 1 from tyredesk.shop))) with check ((select exists(select 1 from tyredesk.shop)));
create policy owner_devices on tyredesk.devices to authenticated using ((select exists(select 1 from tyredesk.shop))) with check ((select exists(select 1 from tyredesk.shop)));
grant select, update(revision,last_delete) on tyredesk.shop to authenticated;
grant select, insert, update, delete on tyredesk.records to authenticated;
grant select,insert on tyredesk.devices to authenticated;

create function public.tyredesk_head() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare s tyredesk.shop;
begin
  select * into strict s from tyredesk.shop;
  return jsonb_build_object('revision',s.revision,'lastDelete',s.last_delete,'databaseBytes',pg_database_size(current_database()));
exception when no_data_found then raise exception 'This account does not own this shop' using errcode='42501';
end $$;

create function public.tyredesk_device(token uuid) returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
  select series into n from tyredesk.devices where device=token;
  if n is null then
    insert into tyredesk.devices(device) values(token) on conflict do nothing;
    select series into strict n from tyredesk.devices where device=token;
  end if;
  return n;
end $$;

create function public.tyredesk_page(since_revision bigint,after_kind text,after_key text)
returns table(kind text,key text,doc jsonb) language sql stable security invoker set search_path='' as $$
  select r.kind,r.key,r.doc from tyredesk.records r
  where r.revision>since_revision and (r.kind,r.key)>(after_kind,after_key)
  order by r.kind,r.key limit 100;
$$;

create function public.tyredesk_commit(expected_revision bigint,changes jsonb)
returns bigint language plpgsql security invoker set search_path='' as $$
declare cur bigint; next_rev bigint; c jsonb; k text; ident text; d jsonb; removed boolean:=false; affected text[]:='{}';
begin
  select revision into strict cur from tyredesk.shop for update;
  if cur<>expected_revision then return -1; end if;
  if jsonb_typeof(changes)<>'array' then raise exception 'Invalid change list'; end if;
  if jsonb_array_length(changes)=0 then return cur; end if;
  next_rev:=cur+1;
  for c in select value from jsonb_array_elements(changes) loop
    k:=c->>'kind'; ident:=c->>'key'; d:=c->'doc';
    if k='meta' and ident !~ '^supplier-(pdf|invoice)-' then raise exception 'Invalid import reference'; end if;
    if k='settings' and (ident<>'shop' or d ?| array['pinHash','pinSalt']) then raise exception 'Invalid cloud settings'; end if;
    if d='null'::jsonb then
      if k<>'reminders' then raise exception 'Only pending reminders can be removed by sync'; end if;
      delete from tyredesk.records where kind=k and key=ident;
      removed:=true;
    else
      if k='catalog' and (d->>'stockQty')::bigint<0 then raise exception 'Insufficient shared stock'; end if;
      if k='orders' then affected:=array_append(affected,ident); end if;
      if k='payments' then affected:=array_append(affected,d->>'orderId'); end if;
      insert into tyredesk.records(kind,key,doc,revision) values(k,ident,d,next_rev)
        on conflict(kind,key) do update set doc=excluded.doc,revision=excluded.revision;
    end if;
  end loop;
  if exists (
    select 1 from (select distinct unnest(affected) id) a
    left join tyredesk.records o on o.kind='orders' and o.key=a.id
    left join lateral (select coalesce(sum((p.doc->>'amountPaise')::bigint),0) paid
      from tyredesk.records p where p.kind='payments' and p.doc->>'orderId'=a.id) totals on true
    where o.key is null or paid<0 or paid>(o.doc->'totals'->>'grandPaise')::bigint or (o.doc->>'status'='cancelled' and paid<>0)
  ) then raise exception 'Payment or cancellation conflicts with the shared invoice balance'; end if;
  update tyredesk.shop set revision=next_rev,last_delete=case when removed then next_rev else last_delete end where singleton;
  return next_rev;
end $$;

revoke all on function public.tyredesk_head(),public.tyredesk_device(uuid),public.tyredesk_page(bigint,text,text),public.tyredesk_commit(bigint,jsonb) from public,anon;
grant execute on function public.tyredesk_head(),public.tyredesk_device(uuid),public.tyredesk_page(bigint,text,text),public.tyredesk_commit(bigint,jsonb) to authenticated;
notify pgrst,'reload schema';
