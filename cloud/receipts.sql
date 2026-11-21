alter table tyredesk.devices add column last_token uuid, add column last_revision bigint;
grant update(last_token,last_revision) on tyredesk.devices to authenticated;
create function public.tyredesk_receipt(device_token uuid,write_token uuid) returns bigint language sql stable security invoker set search_path='' as $$
  select coalesce((select last_revision from tyredesk.devices where device=device_token and last_token=write_token),-1);
$$;
alter function public.tyredesk_commit(bigint,jsonb) set schema tyredesk;
create function public.tyredesk_commit(expected_revision bigint,changes jsonb,device_token uuid,write_token uuid)
returns bigint language plpgsql security invoker set search_path='' as $$
declare rev bigint;
begin
  select last_revision into rev from tyredesk.devices where device=device_token and last_token=write_token for update;
  if found then return rev; end if;
  rev:=tyredesk.tyredesk_commit(expected_revision,changes);
  if rev>=0 then
    update tyredesk.devices set last_token=write_token,last_revision=rev where device=device_token;
    if not found then raise exception 'Register this device first'; end if;
  end if;
  return rev;
end $$;
revoke all on function public.tyredesk_receipt(uuid,uuid),public.tyredesk_commit(bigint,jsonb,uuid,uuid) from public,anon;
grant execute on function public.tyredesk_receipt(uuid,uuid),public.tyredesk_commit(bigint,jsonb,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
