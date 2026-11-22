import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {mockShopAccount} from './shop-account.mjs';
const root=new URL('../docs/app/',import.meta.url);
const mime={mjs:'application/javascript',js:'application/javascript',html:'text/html',css:'text/css'};
const server=http.createServer(async(req,res)=>{
 try{
  const uri=new URL(req.url,'http://127.0.0.1');
  const name=uri.pathname==='/'?'index.html':uri.pathname.slice(1);
  res.setHeader('Content-Type',mime[name.split('.').at(-1)]||'application/octet-stream');
  res.end(await fs.readFile(new URL(name,root)));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {attach,records,retireBillingDevice}=mockShopAccount();
const browser=await chromium.launch();
const url='http://127.0.0.1:'+server.address().port;
const login=page=>page.evaluate(async ()=>{
 const c=await import('./src/cloud.mjs');
 await c.loginCloud({username:'fixture',password:'fixture-only',pin:{pinHash:'fixture',pinSalt:'00'}});
});
const orders=page=>page.evaluate(async()=>(await import('./src/db.mjs')).all('orders').then(a=>a.length));
const bill=page=>page.evaluate(async()=>(await import('./src/db.mjs')).completeOrder({
 customerName:'Audit fixture',items:[{name:'Alignment',type:'service',qty:1,unitPaise:50000}],paidPaise:50000
}));
async function device(){
 const ctx=await browser.newContext({serviceWorkers:'block'});
 await attach(ctx);
 const page=await ctx.newPage();
 await page.goto(url);await page.waitForSelector('#cloud-form');
 return {ctx,page};
}
try{
 const a=await device();
 await login(a.page);
 await a.page.evaluate(async()=>{
  const c=await import('./src/cloud.mjs');
  await c.finishFirstSetup({id:'shop',name:'Launch audit fixture',owner:'Test owner',createdAt:'2026-11-21',
    inventoryMode:'simple',pinSalt:'00',pinHash:'fixture'});
  await c.startBilling();
 });
 const tyre=await a.page.evaluate(async()=>(await import('./src/db.mjs')).buyTyres({
  mode:'simple',brand:'Recovery fixture',qty:3,costPaise:25000,pricePaise:50000
 }).then(p=>p.productId));
 await bill(a.page);
 await a.page.evaluate(async()=>(await import('./src/cloud.mjs')).syncCloud());
 assert.equal([...records.keys()].filter(key=>key.startsWith('orders/')).length,1);
 await a.ctx.setOffline(true);
 await a.page.evaluate(async catalogId=>(await import('./src/db.mjs')).completeOrder({
  customerName:'Offline fixture',items:[{catalogId,name:'Recovery fixture',type:'tyre',qty:1,unitPaise:50000}],
  paidPaise:50000,paymentMethod:'upi',paymentReference:'RECOVERED-TEST-UTR'
 }),tyre);
 const backup=await a.page.evaluate(async()=>(await import('./src/db.mjs')).exportBackup());
 assert.equal(JSON.parse(backup).payload.data.orders.length,2);
 await a.ctx.close();
 const b=await device();
 await login(b.page);
 assert.equal(await orders(b.page),1);
 await b.page.evaluate(async()=>(await import('./src/cloud.mjs')).startBilling());
 const access=await b.page.evaluate(async()=>(await import('./src/cloud.mjs')).cloudStatus().billingAccess);
 assert.equal(access,'busy');
 await assert.rejects(bill(b.page),/view-only/);
 const restore=await device();
 restore.page.once('dialog',dialog=>dialog.accept());
 await restore.page.locator('#restore-file').setInputFiles({
  name:'verified-shop-backup.json',mimeType:'application/json',buffer:Buffer.from(backup)
 });
 await restore.page.waitForSelector('#unlock-form');
 assert.equal(await orders(restore.page),2);
 await login(restore.page);
 const status=await restore.page.evaluate(async()=>(await import('./src/cloud.mjs')).cloudStatus());
 assert.equal(status.blocked,false);
 assert.match(status.message,/backup reconciled locally/i);
 await assert.rejects(bill(restore.page),/view-only/);
 assert.equal([...records.keys()].filter(key=>key.startsWith('orders/')).length,1);
 retireBillingDevice();
 await restore.page.evaluate(async()=>(await import('./src/cloud.mjs')).startBilling());
 assert.equal(await restore.page.evaluate(async()=>(await import('./src/cloud.mjs')).cloudStatus().billingAccess),'active');
 assert.equal([...records.keys()].filter(key=>key.startsWith('orders/')).length,2);
 assert.equal([...records.keys()].filter(key=>key.startsWith('payments/')).length,2);
 assert.equal(records.get('catalog/'+tyre).doc.stockQty,2);
 assert.equal([...records.values()].filter(r=>r.kind==='inventoryMovements'&&r.doc.type==='sale').length,1);
 await restore.page.evaluate(async()=>(await import('./src/cloud.mjs')).syncCloud());
 assert.equal([...records.keys()].filter(key=>key.startsWith('orders/')).length,2);
 await bill(restore.page);
 console.log('PASS: device replacement, offline paid invoice and stock movement synced exactly once, replacement can bill');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
