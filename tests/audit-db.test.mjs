import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const read=file=>fs.readFile(new URL('../'+file,import.meta.url),'utf8');
const users=['0176b852-4d14-4dc1-b513-88871d053755','54bf0e34-64fd-41fe-a08f-224d0ac32d3d'];
const token='2076b852-4d14-4dc1-b513-88871d053755';
const write='3076b852-4d14-4dc1-b513-88871d053755';
const newWrite='4076b852-4d14-4dc1-b513-88871d053755';
async function make(owner){
 const db=new PGlite();
 await db.exec(`create role authenticated; create role anon; create schema auth;
 create table auth.users(id uuid primary key);
 insert into auth.users values ('${users[0]}'),('${users[1]}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; create schema storage; create table storage.objects(metadata jsonb);`);
 await db.exec(await read('cloud/setup.sql'));
 await db.exec(await read('cloud/receipts.sql'));
 const monitor=(await read('supabase/migrations/20261122081720_inventory_identity_and_monitoring.sql')).split('create extension if not exists pg_cron')[0];
 await db.exec(monitor);
 await db.query('insert into tyredesk.shop(owner_id) values ($1)',[owner]);
 await db.exec(await read('supabase/migrations/20261122101614_restrict_business_tables_to_sync_rpc.sql'));
 const act=async id=>db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`);
 await act(owner);
 const commit=(revision,changes,id=write)=>db.query('select public.tyredesk_commit($1,$2,$3,$4)',[revision,JSON.stringify(changes),token,id]);
 return {db,act,commit};
}
const a=await make(users[0]), b=await make(users[1]);
try{
 for(const [i,shop] of [a,b].entries()){
  await shop.db.query('select public.tyredesk_device($1)',[token]);
  const profile={kind:'settings',key:'shop',doc:{id:'shop',name:'Audit '+(i+1),inventoryMode:i===0?'simple':'detailed'}};
  const mode=profile.doc.inventoryMode;
  const tyre={kind:'catalog',key:'tyre-1',doc:{id:'tyre-1',type:'tyre',brand:'MRF',...(i?{model:'Test',size:'165/80 R14'}:{}),inventoryMode:mode,tyreIdentity:i?'["mrf","test","165/80r14"]':'["mrf"]',stockQty:5}};
  assert.equal((await shop.commit(0,[profile,tyre])).rows[0].tyredesk_commit,1);
  assert.equal((await shop.commit(0,[profile,tyre])).rows[0].tyredesk_commit,1);
  assert.equal((await shop.commit(0,[profile,tyre],newWrite)).rows[0].tyredesk_commit,-1);
  await assert.rejects(shop.commit(1,[{...tyre,doc:{...tyre.doc,stockQty:-1}}],newWrite),/Insufficient shared stock/);
  await assert.rejects(shop.commit(1,[{...tyre,key:'duplicate',doc:{...tyre.doc,id:'duplicate'}}],newWrite),/duplicate key/);
  assert.equal((await shop.db.query("select doc->>'name' name from public.tyredesk_page(0,'','') where kind='settings'")).rows[0].name,profile.doc.name);
  await assert.rejects(shop.db.query('select count(*) from tyredesk.records'),/permission denied/);
  await shop.act(users[1-i]);
  await assert.rejects(shop.db.query('select public.tyredesk_head()'),/does not own/);
  assert.equal((await shop.db.query("select count(*)::int as n from public.tyredesk_page(0,'','')")).rows[0].n,0);
  await assert.rejects(shop.commit(1,[profile],newWrite));
  await shop.db.exec('reset role; set role anon;');
  await assert.rejects(shop.db.query('select public.tyredesk_head()'),/permission denied/);
  await shop.act(users[i]);
  assert.equal((await shop.db.query('select (public.tyredesk_head()->>\'revision\')::int as version')).rows[0].version,1);
 }
 console.log('PASS: two independent PostgreSQL fixtures, owner and denied roles, stock guard, no direct business-table access, CAS and idempotency');
}finally{await Promise.all([a.db.close(),b.db.close()]);}

