-- TyreDesk: shop-defined permanent tyre identifiers in Detailed mode.
-- Brand remains required; all other stock-key names are chosen at first setup.
-- Legacy detailed [brand, model, size] and variant identities remain supported.
CREATE OR REPLACE FUNCTION tyredesk.guard_inventory_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  selected_mode text;
  tyre_mode text;
  identity jsonb;
  old_identity jsonb;
  base_count integer;
  idx integer;
  catalogue_fields jsonb;
  active_keys jsonb;
  present_keys jsonb;
  old_keys jsonb;
  new_keys jsonb;
  selected_schema text;
  field_based boolean;
begin
  if new.kind = 'settings' and new.key = 'shop' then
    selected_mode := new.doc->>'inventoryMode';
    if selected_mode is not null and selected_mode not in ('simple','detailed') then
      raise exception 'Invalid inventory mode';
    end if;
    if new.doc ? 'tyreIdentitySchema'
       and new.doc->>'tyreIdentitySchema' is distinct from 'field-based-v1' then
      raise exception 'Unknown tyre identity schema';
    end if;
    if new.doc->>'tyreIdentitySchema'='field-based-v1' then
      if selected_mode is distinct from 'detailed' then
        raise exception 'Custom tyre identifiers require detailed inventory';
      end if;
      select c->'fields' into catalogue_fields
        from jsonb_array_elements(coalesce(new.doc->'inventoryCategories','[]'::jsonb)) c
        where c->>'id'='tyres' limit 1;
      if jsonb_typeof(catalogue_fields) is distinct from 'array'
        or jsonb_array_length(catalogue_fields) not between 1 and 12 then
        raise exception 'Choose 1 to 12 tyre identification fields at shop setup';
      end if;
      if exists(select 1 from jsonb_array_elements(catalogue_fields) f
         where nullif(btrim(f->>'id'),'') is null
            or nullif(btrim(f->>'label'),'') is null
            or lower(btrim(f->>'label'))='brand'
            or f->>'stockKey' is distinct from 'true') then
        raise exception 'Invalid shop-defined tyre field';
      end if;
      if (select count(distinct f->>'id') from jsonb_array_elements(catalogue_fields) f)
          <> jsonb_array_length(catalogue_fields)
        or (select count(distinct lower(btrim(f->>'label'))) from jsonb_array_elements(catalogue_fields) f)
          <> jsonb_array_length(catalogue_fields) then
        raise exception 'Duplicate tyre field names or IDs';
      end if;
    end if;
    if tg_op = 'UPDATE' then
      if old.doc->>'inventoryMode' is not null
         and old.doc->>'inventoryMode' is distinct from selected_mode then
        raise exception 'Inventory mode is fixed after shop setup';
      end if;
      if old.doc->>'inventoryModeLocked'='true'
         and new.doc->>'inventoryModeLocked' is distinct from 'true' then
        raise exception 'Inventory mode lock cannot be removed';
      end if;
      if (old.doc->>'tyreIdentitySchema'='field-based-v1'
            and (old.doc->'inventoryCategories' is distinct from new.doc->'inventoryCategories'
              or old.doc->>'inventoryMode' is distinct from selected_mode))
         or old.doc->>'tyreIdentitySchema' is distinct from new.doc->>'tyreIdentitySchema' then
        raise exception 'Shop tyre identifiers are fixed after setup';
      end if;
      if coalesce(old.doc->>'inventoryMode','detailed') is distinct from selected_mode
        and exists (select from tyredesk.records
          where kind = 'catalog' and doc->>'type' = 'tyre' and revision < new.revision) then
        if selected_mode is not null or old.doc ? 'inventoryMode' then
          raise exception 'Inventory mode is locked after stock is created';
        end if;
      end if;
      -- Once a distinct stock variant has been created, changing the set of
      -- stock-identifying fields would make existing SKUs ambiguous.
      select coalesce(jsonb_agg(f->>'id' order by f->>'id'),'[]'::jsonb) into old_keys
        from jsonb_array_elements(coalesce((
          select c->'fields' from jsonb_array_elements(coalesce(old.doc->'inventoryCategories','[]'::jsonb)) c
            where c->>'id'='tyres' limit 1),'[]'::jsonb)) f
        where f->>'stockKey'='true';
      select coalesce(jsonb_agg(f->>'id' order by f->>'id'),'[]'::jsonb) into new_keys
        from jsonb_array_elements(coalesce((
          select c->'fields' from jsonb_array_elements(coalesce(new.doc->'inventoryCategories','[]'::jsonb)) c
            where c->>'id'='tyres' limit 1),'[]'::jsonb)) f
        where f->>'stockKey'='true';
      if old_keys is distinct from new_keys and exists (
        select 1 from tyredesk.records
          where kind='catalog' and doc->>'type'='tyre'
            and doc ? 'tyreIdentity'
            and jsonb_array_length((doc->>'tyreIdentity')::jsonb) =
              case doc->>'inventoryMode' when 'simple' then 2 else 4 end
      ) then
        raise exception 'Tyre stock classification is locked after distinct variants exist';
      end if;
    end if;
    if exists (select from tyredesk.records where kind = 'catalog' and doc ? 'tyreIdentity'
      and (doc->>'inventoryMode') is distinct from selected_mode) then
      raise exception 'Shared stock has a different inventory mode';
    end if;
  elsif new.kind = 'catalog' and new.doc ? 'tyreIdentity' then
    select doc->>'inventoryMode', coalesce((
      select c->'fields' from jsonb_array_elements(coalesce(doc->'inventoryCategories','[]'::jsonb)) c
        where c->>'id'='tyres' limit 1),'[]'::jsonb)
    ,doc->>'tyreIdentitySchema'
    into selected_mode,catalogue_fields,selected_schema
    from tyredesk.records where kind='settings' and key='shop';
    tyre_mode := new.doc->>'inventoryMode';
    identity := (new.doc->>'tyreIdentity')::jsonb;
    field_based := tyre_mode='detailed' and selected_schema='field-based-v1';
    base_count := case when field_based then 2 when tyre_mode='simple' then 1
      when tyre_mode='detailed' then 3 else 0 end;
    if base_count=0 or tyre_mode is distinct from selected_mode or
       new.doc->>'type' is distinct from 'tyre' or
       nullif(btrim(new.doc->>'brand'),'') is null or
       jsonb_typeof(identity) is distinct from 'array' or
       jsonb_array_length(identity) not in (base_count,base_count+1) then
      raise exception 'Invalid shared stock identity';
    end if;
    if tyre_mode='simple' and
      (coalesce(new.doc->>'size','')<>'' or coalesce(new.doc->>'model','')<>'') then
      raise exception 'Simple inventory cannot contain model or size';
    end if;
    if tyre_mode='detailed' and not field_based and (
       nullif(btrim(new.doc->>'model'),'') is null or
       nullif(btrim(new.doc->>'size'),'') is null) then
      raise exception 'Detailed stock requires brand, model and size';
    end if;
    if field_based and (jsonb_array_length(identity)<>3 or identity->>1<>'custom'
          or coalesce(new.doc->>'model','')<>'' or coalesce(new.doc->>'size','')<>'') then
      raise exception 'Detailed stock must use configured tyre identifiers';
    end if;
    if jsonb_array_length(identity)=base_count+1 then
      select coalesce(jsonb_object_agg(f->>'id',true),'{}'::jsonb)
        into active_keys from jsonb_array_elements(catalogue_fields) f
        where f->>'stockKey'='true';
      if jsonb_typeof(identity->base_count) is distinct from 'object' then
        raise exception 'Variant identity must contain keyed attributes';
      end if;
      select coalesce(jsonb_object_agg(k,true),'{}'::jsonb) into present_keys
        from jsonb_object_keys(identity->base_count) k;
      if active_keys='{}'::jsonb or active_keys is distinct from present_keys or
         exists (select 1 from jsonb_each_text(identity->base_count) v
                 where nullif(btrim(v.value),'') is null) then
        raise exception 'Variant identity fields do not match the configured tyre fields';
      end if;
    end if;
    if tg_op='UPDATE' and old.doc ? 'tyreIdentity' and
       (old.doc->>'tyreIdentity' <> new.doc->>'tyreIdentity' or
        old.doc->>'inventoryMode' <> tyre_mode) then
      old_identity := (old.doc->>'tyreIdentity')::jsonb;
      -- Only an explicit one-time reclassification of legacy stock is allowed.
      if jsonb_array_length(old_identity)<>base_count or
         jsonb_array_length(identity)<>base_count+1 then
        raise exception 'A classified tyre identity cannot be reassigned';
      end if;
      for idx in 0..base_count-1 loop
        if old_identity->idx is distinct from identity->idx then
          raise exception 'Brand, model and size cannot change on existing tyre stock';
        end if;
      end loop;
    end if;
  end if;
  return new;
end
$function$
