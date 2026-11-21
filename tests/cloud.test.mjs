import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
const root=new URL('../docs/app/',import.meta.url);
const server=http.createServer(async(req,res)=>{
 try{const name=req.url==='/'?'index.html':req.url.slice(1);
 const bytes=await fs.readFile(new URL(name,root));
 res.setHeader('Content-Type',name.endsWith('.mjs')||name.endsWith('.js')?'application/javascript':name.endsWith('.html')?'text/html':'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch();
const url='http://127.0.0.1:'+server.address().port+'/';
const records=new Map(),devices=new Map(),receipts=new Map();
let revision=0,lastDelete=0,paused=false,loseAck=false;
const sync=page=>page.evaluate(async()=>{const c=await import('./src/cloud.mjs');await c.syncCloud();return c.cloudStatus().message;});
async function open(){
 const ctx=await browser.newContext({serviceWorkers:'block'});
 await ctx.route('https://*.supabase.co/**',async route=>{
  const req=route.request(),endpoint=new URL(req.url()).pathname.split('/').at(-1);
  const send=(data,status=200)=>route.fulfill({status,json:data,headers:{'access-control-allow-origin':'*'}});
  if(paused)return send({message:'Project is paused'},540);
  if(endpoint==='token'){
    const b64=obj=>Buffer.from(JSON.stringify(obj)).toString('base64url');
    const exp=Math.floor(Date.now()/1000)+3600;
    return send({access_token:b64({alg:'HS256'})+'.'+b64({sub:'test-owner',exp})+'.c2ln',refresh_token:'fixture',token_type:'bearer',expires_in:3600,expires_at:exp,user:{id:'test-owner',email:'test@example.invalid'}});
  }
  const b=req.postDataJSON()||{};
  if(endpoint==='tyredesk_device'){if(!devices.has(b.token))devices.set(b.token,devices.size+1);return send(devices.get(b.token));}
  if(endpoint==='tyredesk_head')return send({revision,lastDelete,databaseBytes:1024});
  if(endpoint==='tyredesk_receipt')return send(receipts.get(b.write_token)??-1);
  if(endpoint==='tyredesk_page')return send([...records.values()].filter(x=>x.rev>b.since_revision&&(x.kind>b.after_kind||x.kind===b.after_kind&&x.key>b.after_key)).sort((x,y)=>x.kind<y.kind?-1:x.kind>y.kind?1:x.key<y.key?-1:1).slice(0,100));
  if(endpoint==='tyredesk_commit'){
    if(receipts.has(b.write_token))return send(receipts.get(b.write_token));
    if(b.expected_revision!==revision)return send(-1);
    revision++;for(const c of b.changes){const k=c.kind+'/'+c.key;if(c.doc)records.set(k,{...c,rev:revision});else{records.delete(k);lastDelete=revision;}}
    receipts.set(b.write_token,revision);
    if(loseAck){loseAck=false;return route.abort('connectionreset');}
    return send(revision);
  }
  return send({},404);
 });
 const page=await ctx.newPage();await page.goto(url);await page.waitForSelector('#setup-form');
 return page;
}
const login=page=>page.evaluate(async()=>{await (await import('./src/cloud.mjs')).loginCloud({username:'fixture',password:'fixture-only',pin:{pinHash:'local',pinSalt:'00'}});});
const data=page=>page.evaluate(async()=>(await import('./src/db.mjs')).summaryData());
try{
 const a=await open(),b=await open();
 const ids=await a.evaluate(async()=>{
  const d=await import('./src/db.mjs');
  await d.saveSetting({name:'Fixture',owner:'Owner',createdAt:'2026-01-01',language:'en',pinHash:'local',pinSalt:'00',paymentQrData:'data:image/png;base64,AA=='});
  const p=await d.addCatalogItem({name:'Fixture tyre',type:'tyre',openingStockQty:6});
  const r=await d.saveReminder({title:'Call supplier',dueAt:'2026-01-01T00:00:00.000Z'});return {p:p.id,r:r.id};
 });
 await login(a);await login(b);assert.equal((await data(b)).catalog[0].stockQty,6);assert.equal((await data(b)).settings.paymentQrData,(await data(a)).settings.paymentQrData);
 assert.equal(records.get('settings/shop').doc.pinHash,undefined);
 await b.context().setOffline(true);
 const bill=(page,name)=>page.evaluate(async({id,name})=>(await import('./src/db.mjs')).completeOrder({customerName:name,items:[{catalogId:id,name:'Fixture tyre',type:'tyre',qty:1,unitPaise:5000}]}),{id:ids.p,name});
 const [x,y]=await Promise.all([bill(a,'A'),bill(b,'B')]);assert.notEqual(x.number,y.number);assert.match(await sync(b),/Offline/);
 await a.evaluate(async id=>(await import('./src/db.mjs')).completeReminder(id),ids.r);
 await b.evaluate(async id=>(await import('./src/db.mjs')).saveReminder({id,title:'Stale edit',dueAt:'2026-01-01T00:00:00.000Z'}),ids.r);
 await sync(a);await b.context().setOffline(false);await sync(b);await sync(a);
 for(const p of [a,b]){const d=await data(p);assert.equal(d.orders.length,2);assert.equal(d.catalog[0].stockQty,4);assert.equal(d.reminders.length,0);}
 const pay=page=>page.evaluate(async id=>(await import('./src/db.mjs')).addPayment(id,5000,'upi','','qr-test-'+id),x.id);
 await Promise.all([pay(a),pay(b)]);loseAck=true;await sync(a);await sync(b);await sync(a);await sync(b);
 for(const p of [a,b])assert.equal((await data(p)).payments.length,1);
 paused=true;await a.evaluate(async()=>(await import('./src/db.mjs')).addExpense({amountPaise:300,description:'Offline expense'}));assert.match(await sync(a),/paused/i);
 paused=false;await sync(a);await sync(b);assert.equal((await data(b)).expenses.length,1);
 await a.reload();await sync(a);assert.match(await sync(a),/Up to date/);
 const fresh=await open();await login(fresh);const recovered=await data(fresh);
 assert.equal(recovered.orders.length,2);assert.equal(recovered.reminders.length,0);assert.equal(recovered.payments.length,1);assert.equal(recovered.expenses.length,1);
 console.log('PASS: independent devices, offline bills, stock, retried payment, reminder deletion, paused service, persistent login and recovery');
}finally{await browser.close();await new Promise(r=>server.close(r));}
