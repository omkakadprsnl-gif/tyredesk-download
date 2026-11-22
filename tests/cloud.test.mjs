import {mockShopAccount,signIn} from './shop-account.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
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
const {attach,control,records}=mockShopAccount();
const sync=page=>page.evaluate(async()=>{const c=await import('./src/cloud.mjs');await c.syncCloud();return c.cloudStatus().message;});
async function open(){
 const ctx=await browser.newContext({serviceWorkers:'block'});
 await attach(ctx);
 const page=await ctx.newPage();await page.goto(url);await page.waitForSelector('#cloud-form');
 return page;
}
const login=page=>page.evaluate(async()=>{await (await import('./src/cloud.mjs')).loginCloud({username:'fixture',password:'fixture-only',pin:{pinHash:'local',pinSalt:'00'}});});
const data=page=>page.evaluate(async()=>(await import('./src/db.mjs')).summaryData());
const handover=(page,action)=>page.evaluate(async action=>(await import('./src/cloud.mjs'))[action](),action);
try{
 const a=await open(),b=await open();
 await a.evaluate(async()=>{
  const c=await import('./src/cloud.mjs');
  await c.loginCloud({username:'fixture',password:'fixture-only',onboarding:true});
  await c.finishFirstSetup({id:'shop',name:'Fixture',owner:'Owner',createdAt:'2026-01-01',
    language:'en',pinHash:'local',pinSalt:'00',inventoryMode:'simple',paymentQrData:'data:image/png;base64,AA=='});
 });
 await login(b);
 const stock=(page,id,qty)=>page.evaluate(async({id,qty})=>(await import('./src/db.mjs')).adjustStock(id,qty,'Handover fixture'),{id,qty});
 control.loseClaimAck=true;
 await assert.rejects(handover(a,'startBilling'),/fetch/i);
 await handover(b,'startBilling');
 await handover(a,'startBilling');
 const ids=await a.evaluate(async()=>{
  const d=await import('./src/db.mjs');
  const p=await d.addCatalogItem({brand:'MRF',name:'Fixture tyre',type:'tyre',openingStockQty:1});
  const r=await d.saveReminder({title:'Call supplier',dueAt:'2026-01-01T00:00:00.000Z'});return {p:p.id,r:r.id};
 });
 await sync(a);await sync(b);
 assert.equal((await data(b)).catalog[0].stockQty,1);assert.equal((await data(b)).settings.paymentQrData,(await data(a)).settings.paymentQrData);
 assert.equal(records.get('settings/shop').doc.pinHash,undefined);
 const bill=(page,name)=>page.evaluate(async({id,name})=>(await import('./src/db.mjs')).completeOrder({customerName:name,items:[{catalogId:id,name:'Fixture tyre',type:'tyre',qty:1,unitPaise:5000}]}),{id:ids.p,name});
 await a.context().setOffline(true);
 const [sale,rejected]=await Promise.allSettled([bill(a,'A'),bill(b,'B')]);
 assert.equal(sale.status,'fulfilled');const x=sale.value;
 assert.match(rejected.reason.message,/view-only/);
 assert.match(await sync(a),/Connection unavailable/);
 await assert.rejects(handover(a,'finishBilling'),/Connect to the internet/);
 await handover(b,'startBilling');
 await assert.rejects(stock(b,ids.p,1),/view-only/);
 await a.evaluate(async id=>(await import('./src/db.mjs')).completeReminder(id),ids.r);
 const pay=page=>page.evaluate(async id=>(await import('./src/db.mjs')).addPayment(id,5000,'upi','','qr-test-'+id),x.id);
 await Promise.all([pay(a),pay(a)]);
 const tab=await a.context().newPage();
 await a.context().setOffline(false);
 await tab.goto(url);await tab.waitForSelector('#cloud-form, #unlock-form, .shell');
 const saved=await a.evaluate(async()=>(await import('./src/db.mjs')).exportBackup());
 await assert.rejects(a.evaluate(async backup=>(await import('./src/db.mjs')).restoreBackup(backup,{disconnectCloud:true}),saved),/Billing must be released/);
 const expense=page=>page.evaluate(async()=>(await import('./src/db.mjs')).addExpense({amountPaise:300,description:'Offline expense'}));
 control.paused=true;
 await expense(a);assert.match(await sync(a),/paused/i);
 await assert.rejects(handover(a,'finishBilling'),/paused/i);
 await assert.rejects(expense(tab),/switching devices/);
 await assert.rejects(handover(b,'startBilling'),/paused/i);
 control.paused=false;control.loseAck=true;
 await sync(a);await sync(a);
 control.loseReleaseAck=true;
 await assert.rejects(handover(a,'finishBilling'),/fetch/i);
 await handover(b,'startBilling');
 await assert.rejects(bill(b,'Last tyre B'),/Insufficient stock/);
 await assert.rejects(bill(a,'Old device'),/switching devices/);
 await handover(a,'finishBilling');
 await assert.rejects(bill(a,'Old device'),/view-only/);
 await stock(b,ids.p,1);
 const y=await bill(b,'B after restocking');assert.notEqual(x.number,y.number);
 await sync(b);await sync(a);
 for(const p of [a,b]){
  const d=await data(p);assert.equal(d.orders.length,2);assert.equal(d.catalog[0].stockQty,0);
  assert.equal(d.reminders.length,0);assert.equal(d.payments.length,1);assert.equal(d.expenses.length,1);
 }
 const fresh=await open();assert.equal(await fresh.locator('#setup-form,[name=project],[name=key]').count(),0);
 control.failRead=true;await signIn(fresh);await fresh.waitForSelector('[data-action=account-retry]');assert.equal(await fresh.locator('#setup-form').count(),0);
 control.failRead=false;await fresh.locator('[data-action=account-retry]').click();await fresh.waitForSelector('#device-pin-form');assert.equal(await fresh.locator('#setup-form').count(),0);
 await fresh.locator('[name=devicePin]').fill('1234');await fresh.locator('[name=repeatPin]').fill('1234');
 await fresh.locator('#device-pin-form button').click();await fresh.waitForSelector('.shell');const recovered=await data(fresh);
 await fresh.reload();await fresh.waitForSelector('.shell');assert.equal(await fresh.locator('#cloud-form,#setup-form').count(),0);
 await fresh.getByText('Billing is open on another device.',{exact:false}).waitFor();
 assert.equal(recovered.orders.length,2);assert.equal(recovered.reminders.length,0);assert.equal(recovered.payments.length,1);assert.equal(recovered.expenses.length,1);
 await fresh.close();
 const secondShop=mockShopAccount({ref:'bbbbbbbbbbbbbbbbbbbb',alias:'second',owner:'second-owner'});
 secondShop.control.billingHandover=false;
 const secondContext=await browser.newContext({serviceWorkers:'block'});
 await secondShop.attach(secondContext);
 const second=await secondContext.newPage();await second.goto(url);
 const sourceBackup=await a.evaluate(async()=>(await import('./src/db.mjs')).exportBackup());
 await second.evaluate(async backup=>(await import('./src/db.mjs')).restoreBackup(backup),sourceBackup);
 await assert.rejects(second.evaluate(async()=>(await import('./src/cloud.mjs')).loginCloud({username:'second',password:'fixture-only'})),/different shop/);
 assert.equal(secondShop.records.size,0);
 // A separate storage context can provision the intended shop from the directory.
 const thirdContext=await browser.newContext({serviceWorkers:'block'});
 await secondShop.attach(thirdContext);
 const third=await thirdContext.newPage();await third.goto(url);
 await third.evaluate(async()=>{
  const c=await import('./src/cloud.mjs');
  await c.loginCloud({username:'second',password:'fixture-only',onboarding:true});
  await c.finishFirstSetup({id:'shop',name:'Independent second shop',createdAt:'2026-11-22',
    pinHash:'local',pinSalt:'00',inventoryMode:'simple'},[
      {id:'wheel-alignment',name:'Wheel alignment',type:'service',pricePaise:65000,trackStock:false,stockQty:0}
  ]);
 });
 assert.equal((await data(third)).orders.length,0);
 assert.equal(secondShop.records.get('settings/shop').doc.name,'Independent second shop');
 assert.equal(secondShop.records.get('catalog/wheel-alignment').doc.pricePaise,65000);
 await expense(third);await sync(third);
 assert.equal([...secondShop.records.values()].filter(row=>row.kind==='expenses').length,1);
 secondShop.control.billingHandover=true;
 await sync(third);
 await assert.rejects(expense(third),/view-only/);
 await handover(third,'startBilling');
 await expense(third);await sync(third);
 assert.equal([...secondShop.records.values()].filter(row=>row.kind==='expenses').length,2);
 assert.equal(records.get('settings/shop').doc.name,'Fixture');
 await handover(b,'finishBilling');
 await Promise.all([handover(a,'startBilling'),handover(b,'startBilling')]);
 const competingWrites=await Promise.allSettled([expense(a),expense(b)]);
 assert.equal(competingWrites.filter(result=>result.status==='fulfilled').length,1);
 const owner=competingWrites[0].status==='fulfilled'?a:b;
 const next=owner===a?b:a;
 async function foreground(page){
  await page.evaluate(async()=>{
   Object.defineProperty(document,'hidden',{configurable:true,value:false});
   (await import('./src/cloud.mjs')).startCloud(()=>true);
  });
  await page.waitForFunction(async()=>(await navigator.locks.query()).held.some(lock=>lock.name==='tyredesk-foreground'));
 }
 await foreground(owner);await foreground(next);
 await owner.evaluate(()=>window.dispatchEvent(new CustomEvent('tyredesk-native-foreground',{detail:false})));
 const phase=page=>page.evaluate(async()=>(await (await import('./src/cloud-store.mjs')).localCloud())?.billing?.phase);
 for(let attempt=0;attempt<100&&(await phase(next)!=='active'||await phase(owner));attempt++)await delay(100);
 assert.equal(await phase(next),'active');
 assert.equal(await phase(owner),undefined);
 await assert.rejects(expense(owner),/view-only/);
 assert.equal((await data(next)).expenses.length,2);
 console.log('PASS: two billing devices, offline exclusivity, last-tyre protection, release and claim retries, paused service, duplicate payment prevention and shop recovery');
}finally{await browser.close();await new Promise(r=>server.close(r));}
