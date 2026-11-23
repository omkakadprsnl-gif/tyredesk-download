import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const read=path=>fs.readFile(new URL('../'+path,import.meta.url),'utf8');
const db=new PGlite();
const owner='0176b852-4d14-4dc1-b513-88871d053755';
const shop={id:'shop',name:'Custom identity store',inventoryMode:'detailed',
 inventoryModeLocked:true,tyreIdentitySchema:'field-based-v1',
 inventoryCategories:[{id:'tyres',name:'Tyres',
  fields:[{id:'field-color',label:'Color',stockKey:true},
          {id:'field-code',label:'Product Code',stockKey:true}]}]};
async function write(kind,key,doc){
 await db.query('insert into tyredesk.records(kind,key,doc,revision) values($1,$2,$3::jsonb,1) '+
   'on conflict(kind,key) do update set doc=excluded.doc,revision=tyredesk.records.revision+1',
   [kind,key,JSON.stringify(doc)]);
}
const tyre=(id,color,code)=>({id,type:'tyre',name:'MRF '+color,brand:'MRF',model:'',size:'',
 inventoryMode:'detailed',tyreIdentity:JSON.stringify(['mrf','custom',{'field-color':color.toLowerCase(),'field-code':code.toLowerCase()}]),
 attributes:{'field-color':color,'field-code':code},stockQty:4,costPaise:10000,pricePaise:20000});
try{
 await db.exec("create role authenticated; create role anon; create schema auth;"+
  " create table auth.users(id uuid primary key);"+
  " create function auth.uid() returns uuid language sql stable as $$"+
  " select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;"+
  " grant usage on schema auth to authenticated; create schema storage;"+
  " create table storage.objects(metadata jsonb);");
 await db.exec(await read('cloud/setup.sql'));
 await db.exec(await read('cloud/receipts.sql'));
 await db.exec((await read('supabase/migrations/20261122081720_inventory_identity_and_monitoring.sql'))
  .split('create extension if not exists pg_cron')[0]);
 await db.exec("insert into auth.users(id) values('"+owner+"');"+
   " insert into tyredesk.shop(owner_id) values('"+owner+"');");
 for(const migration of [
  '20261122101614_restrict_business_tables_to_sync_rpc.sql',
  '20261122103925_enforce_billing_device_handover.sql',
  '20261122120000_fix_billing_singleton_predicates.sql',
  '20261122204818_enforce_shop_payment_refs_and_device_retirement.sql',
  '20261123010000_tyre_custom_variant_identity.sql',
  '20261123060000_shop_defined_tyre_fields.sql'
 ]){
   const sql=await read('supabase/migrations/'+migration);
   if(migration==='20261123060000_shop_defined_tyre_fields.sql'){
     const tag='-- Trigger swap is transactional: failed migration leaves the old guard active.';
     const parts=sql.split(tag);
     assert.equal(parts.length,2);
     // PGlite's prepared execution parser treats a quoted CREATE FUNCTION as
     // one statement. Issue the function and subsequent DDL separately.
     await db.exec(parts[0]);
     await db.exec(parts[1]);
   }else await db.exec(sql);
 }
 await db.exec("select set_config('request.jwt.claim.sub','"+owner+"',false)");
 await write('settings','shop',shop);
 await write('catalog','red',tyre('red','Red','A1'));
 await write('catalog','blue',tyre('blue','Blue','A1'));
 assert.equal((await db.query("select count(*)::int n from tyredesk.records where kind='catalog'")).rows[0].n,2);
 await assert.rejects(write('catalog','duplicated',tyre('duplicated','Red','A1')),
   /duplicate|unique|tyredesk_inventory_identity/i);
 await assert.rejects(write('catalog','missing',{...tyre('missing','Green','A2'),
   tyreIdentity:JSON.stringify(['mrf','custom',{'field-color':'green'}])}),/Variant identity fields/i);
 await assert.rejects(write('catalog','oldstyle',{...tyre('oldstyle','Green','A2'),
   tyreIdentity:JSON.stringify(['mrf','zlx','145/80r12'])}),/Detailed stock must use configured/i);
 await assert.rejects(write('settings','shop',{...shop,inventoryMode:'simple'}),/fixed|identifiers/i);
 await assert.rejects(write('settings','shop',{...shop,inventoryCategories:[{id:'tyres',name:'Tyres',fields:[
    {id:'field-color',label:'Model',stockKey:true},{id:'field-code',label:'Product Code',stockKey:true}]}]}),
   /fixed after setup/i);
 const count=(await db.query("select count(*)::int n from tyredesk.records where kind='catalog'")).rows[0].n;
 assert.equal(count,2,'Rejected classifications must not erase existing stock');
 console.log('PASS: SQL enforces immutable configured tyre stock keys, legacy format exclusion, uniqueness and stock preservation');
}finally{await db.close();}
