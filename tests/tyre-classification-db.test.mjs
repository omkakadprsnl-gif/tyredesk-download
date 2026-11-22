import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const read=p=>fs.readFile(new URL('../'+p,import.meta.url),'utf8');
const db=new PGlite();
const owner='0176b852-4d14-4dc1-b513-88871d053755';
const fixture=(id,identity,attributes={load:'88H'})=>({
 id,type:'tyre',name:'MRF ZLX',brand:'MRF',model:'ZLX',size:'185/65 R15',
 inventoryMode:'detailed',tyreIdentity:identity,attributes,stockQty:4
});
const base=['mrf','zlx','185/65r15'];
const baseId=JSON.stringify(base);
const variant=v=>JSON.stringify([...base,{load:v.toLowerCase()}]);
const shop={id:'shop',name:'Tyre variant fixture',inventoryMode:'detailed',
 inventoryCategories:[{id:'tyres',name:'Tyres',fields:[{id:'load',label:'Load Index',stockKey:true}]}]};
async function write(kind,key,doc){
 await db.query('insert into tyredesk.records(kind,key,doc,revision) values($1,$2,$3::jsonb,1) '+
   'on conflict(kind,key) do update set doc=excluded.doc,revision=tyredesk.records.revision+1',
  [kind,key,JSON.stringify(doc)]);
}
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
 await db.exec(await read('supabase/migrations/20261122101614_restrict_business_tables_to_sync_rpc.sql'));
 await db.exec(await read('supabase/migrations/20261122103925_enforce_billing_device_handover.sql'));
 await db.exec(await read('supabase/migrations/20261122120000_fix_billing_singleton_predicates.sql'));
 await db.exec(await read('supabase/migrations/20261122204818_enforce_shop_payment_refs_and_device_retirement.sql'));
 await write('settings','shop',shop);
 await write('catalog','legacy',fixture('legacy',baseId,{}));
 await db.exec(await read('supabase/migrations/20261123010000_tyre_custom_variant_identity.sql'));
 await write('catalog','variant-88',fixture('variant-88',variant('88H')));
 await write('catalog','variant-92',fixture('variant-92',variant('92V'),{load:'92V'}));
 assert.equal((await db.query("select count(*)::int n from tyredesk.records where kind='catalog'")).rows[0].n,3);
 await assert.rejects(write('catalog','duplicate',fixture('duplicate',variant('88H'))),
   /tyredesk_inventory_identity|duplicate key/);
 await assert.rejects(write('catalog','missing-extra',fixture('missing-extra',
   JSON.stringify([...base,{different:'100h'}]))),/Variant identity fields/);
 await assert.rejects(write('catalog','wrong-type',fixture('wrong-type',
   JSON.stringify([...base,'88h']))),/keyed attributes/);
 await write('catalog','legacy',fixture('legacy',variant('84T'),{load:'84T'}));
 assert.equal((await db.query("select doc->>'tyreIdentity' identity from tyredesk.records where key='legacy'")).rows[0].identity,variant('84T'));
 await assert.rejects(write('catalog','variant-88',fixture('variant-88',variant('100Z'),{load:'100Z'})),
   /cannot be reassigned/);
 await assert.rejects(write('settings','shop',
   {...shop,inventoryCategories:[{id:'tyres',name:'Tyres',
     fields:[{id:'load',label:'Load Index',stockKey:false}]}]}),
   /classification is locked/);
 assert.equal((await db.query("select doc->'inventoryCategories'->0->'fields'->0->>'stockKey' enabled from tyredesk.records where kind='settings'")).rows[0].enabled,'true');
 assert.equal((await db.query("select count(*)::int n from tyredesk.records where kind='catalog'")).rows[0].n,3);
 console.log('PASS: cloud accepts distinct variants, preserves legacy IDs and rejects ambiguous identities and classification changes');
}finally{await db.close();}
