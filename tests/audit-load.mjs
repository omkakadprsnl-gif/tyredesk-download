import {chromium} from 'playwright';
import {performance} from 'node:perf_hooks';
import fs from 'node:fs/promises';
import http from 'node:http';
const server=http.createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://local').pathname;
  const name=path.endsWith('/')?path+'index.html':path;
  const suffix=name.split('.').at(-1);
  res.setHeader('Content-Type',({mjs:'application/javascript',js:'application/javascript',html:'text/html',css:'text/css'})[suffix]||'application/octet-stream');
  res.end(await fs.readFile(new URL('../docs'+name,import.meta.url)));
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch();
try{
 const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:820}});
 const page=await ctx.newPage();
 const url='http://127.0.0.1:'+server.address().port+'/app/';
 const started=performance.now();await page.goto(url);await page.waitForSelector('#cloud-form');
 const cold=Math.round(performance.now()-started);
 await page.evaluate(async()=>{
  const d=await import('./src/db.mjs');
  await d.saveSetting({name:'Load test shop',createdAt:'2026-11-22T10:00:00Z',gstRegistered:false});
  await d.transact(['customers','vehicles','orders','payments','meta'],'readwrite',tx=>{
   tx.objectStore('meta').put({id:'invoice-'+new Date().getFullYear(),value:2000});
   const padded=i=>String(i).padStart(5,'0');
   for(let i=0;i<10000;i++){
    const code=padded(i),id='customer-'+code,phone='98765'+code;
    tx.objectStore('customers').add({id,name:'Fixture '+code,searchName:'fixture '+code,phone,phoneNorm:phone,createdAt:'2026-11-22T10:00:00Z'});
    tx.objectStore('vehicles').add({id:'vehicle-'+code,customerId:id,regNorm:'MH21'+code});
    if(i>=2000)continue;
    const order='invoice-'+code,createdAt='2026-11-22T10:00:00Z';
    tx.objectStore('orders').add({id:order,number:'INV-2026-'+code,requestId:'req-'+code,date:'2026-11-22',createdAt,
      customerId:id,customerSnapshot:{name:'Fixture '+code,phone},status:'completed',items:[{name:'Alignment',qty:1,unitPaise:120000,taxablePaise:120000}],totals:{grandPaise:120000,taxablePaise:120000}});
    tx.objectStore('payments').add({id:'pay-'+code,orderId:order,amountPaise:90000,type:'received',createdAt});
   }
  });
  sessionStorage.setItem('tyredesk-unlocked','yes');
 });
 const boot=performance.now();await page.reload();await page.waitForSelector('[data-page=dashboard]');const loaded=Math.round(performance.now()-boot);
 const result=await page.evaluate(async()=>{
  const d=await import('./src/db.mjs');
  const samples=async fn=>{
   const times=[];
   for(let i=0;i<5;i++){const t=performance.now();const result=await fn();times.push(Math.round(performance.now()-t));if(!result)throw Error('Empty benchmark');}
   return times.sort((a,b)=>a-b)[2];
  };
  const summary=await d.summaryData();
  if(summary.orders.reduce((s,o)=>s+o.duePaise,0)!==60000000)throw Error('Load fixture balance did not reconcile');
  return {summaryMedianMs:await samples(()=>d.summaryData()),searchMedianMs:await samples(()=>d.searchCustomers('fixture 019')),
            invoiceCreateMedianMs:await samples(()=>d.completeOrder({customerId:'customer-00000',items:[{name:'Service',qty:1,unitPaise:20000}]})),
            jsonBackupBytes:new TextEncoder().encode(await d.exportBackup()).byteLength};
 });
 console.log(JSON.stringify({coldSigninMs:cold,loadedDashboardMs:loaded,customers:10000,vehicles:10000,invoices:2000,payments:2000,...result}));
}finally{await browser.close();await new Promise(r=>server.close(r));}

