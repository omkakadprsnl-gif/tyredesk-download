import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const app=new URL('../docs/app/',import.meta.url);
let released='1.3.0';
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://local');
 if(url.pathname==='/release.json'){
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({webVersion:released}));return;
 }
 const file=url.pathname.replace(/^\/app\//,'')||'index.html';
 const type={'.mjs':'application/javascript','.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png'};
 try{res.setHeader('Content-Type',type[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(new URL(file,app)));}
 catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const local='http://127.0.0.1:'+server.address().port+'/app/';
const base=process.env.TYREDESK_TEST_URL||local;
const browser=await chromium.launch();
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'tyredesk-print-'));
try{
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:820},hasTouch:width<=390,serviceWorkers:'block'});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',d=>d.type()==='prompt'?d.accept('Test cancellation'):d.accept());
  await page.goto(base);
  await page.evaluate(async()=>{
   const d=await import('./src/db.mjs');
   await d.saveSetting({name:'Test Shop With A Long Shop Name',owner:'Test Owner',createdAt:'2026-11-22T03:00:00Z',
     inventoryMode:'detailed',gstRegistered:true,pinHash:'test',pinSalt:'00',gstin:'27ABCDE1234F1Z5'});
   sessionStorage.setItem('tyredesk-unlocked','yes');
   for(const [brand,model,size,qty] of [
     ['MRF','ZLX','145/80 R12',10],['MRF','ZLX','165/80 R14',8],
     ['MRF','ZVTV','145/80 R12',6],['Apollo','Amazer','175/65 R14',9],
     ['Long Brand Name For Mobile Layout','Very Long Model Name For Layout','215/60 R16',8]
   ])await d.buyTyres({mode:'detailed',brand,model,size,qty,costPaise:200000,pricePaise:400000});
   await d.upsertCustomer({name:'A very long test customer name for checking narrow phone widths',phone:'0000000000'});
   await d.addExpense({description:'A long expense label that needs to wrap on a small screen',category:'Testing',amountPaise:50000});
  });
  await page.reload();
  await page.waitForSelector('.shell');
  const nav=async name=>{
   await page.evaluate(n=>document.querySelector('[data-nav="'+n+'"]').click(),name);
   await page.waitForSelector('[data-page="'+name+'"]');
  };
  const fits=async label=>{
   const widths=await page.evaluate(()=>({view:document.documentElement.clientWidth,doc:document.documentElement.scrollWidth,
     body:document.body.scrollWidth}));
   assert.ok(widths.doc<=widths.view+1&&widths.body<=widths.view+1,label+': '+JSON.stringify(widths));
  };
  for(const name of ['dashboard','customers','inventory','billing','sales','expenses','reports','catalog','settings','dues','reminders']){
   await nav(name);await fits(name+' at '+width);
  }
  await nav('settings');assert.equal(await page.locator('#inventory-mode-form fieldset').evaluate(f=>f.disabled),true);
  await page.getByRole('heading',{name:'Update App'}).waitFor();
  if(!process.env.TYREDESK_TEST_URL){
   await page.getByText('You’re using the latest version.',{exact:true}).waitFor();
   if(width===320){
    released='1.3.1';await page.getByRole('button',{name:'Check for updates'}).click();
    await page.getByText('Update Available',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:/later|dismiss/i}).count(),0);
    await nav('billing');await page.getByText('Update Available',{exact:true}).waitFor();
    released='1.3.0';
   }
  }
  await nav('inventory');await page.locator('[data-action=buy-tyres]').click();await fits('Add stock dialog at '+width);
  await page.locator('#purchase-form [name=brand]').fill('MRF');
  assert.deepEqual(await page.locator('#buy-list-model option').evaluateAll(items=>items.map(o=>o.value)),['ZLX','ZVTV']);
  await page.locator('#purchase-form [name=model]').fill('ZLX');
  assert.deepEqual(await page.locator('#buy-list-size option').evaluateAll(items=>items.map(o=>o.value)),['145/80 R12','165/80 R14']);
  await page.locator('#purchase-form [name=size]').fill('145/80 R12');
  await page.locator('#purchase-form [name=qty]').fill('2');
  await page.locator('[form=purchase-form]').click();await page.waitForFunction(()=>!document.querySelector('#purchase-form'));
  await page.locator('[data-restock]').first().click();await fits('Restock at '+width);
  await page.locator('[data-action=close-modal]').first().click();
  await nav('billing');
  await page.locator('#bill-payment-qr [data-action=qr-settings]').waitFor();
  const picker=page.locator('#tyre-bill-form');
  await picker.locator('[name=brand]').selectOption('MRF');
  await picker.locator('[name=model]').selectOption('ZLX');
  await picker.locator('[name=size]').selectOption('145/80 R12');
  assert.equal(await picker.locator('[name=qty]').getAttribute('max'),'12');
  await picker.locator('[name=brand]').selectOption('Apollo');
  assert.equal(await picker.locator('[name=model]').inputValue(),'');
  assert.equal(await picker.locator('[name=size]').inputValue(),'');
  await picker.locator('[name=brand]').selectOption('MRF');await picker.locator('[name=model]').selectOption('ZLX');
  await picker.locator('[name=size]').selectOption('145/80 R12');await picker.locator('[name=qty]').fill('2');
  await picker.getByRole('button',{name:'Add tyre to bill'}).click();
  await page.getByText('MRF · ZLX · 145/80 R12',{exact:true}).waitFor();
  assert.equal(await page.locator('.compact-bill-line').getAttribute('open'),null);
  await page.locator('.compact-bill-line summary').click();await page.locator('[data-line-field=qty]').fill('3');
  if(width<=390){
   await page.setViewportSize({width,height:510});await fits('Short keyboard viewport');
   await page.setViewportSize({width,height:820});
  }
  await page.locator('#bill-customer-name').fill('Bill fixture');
  await page.locator('#save-bill').click();
  await page.locator('.invoice-preview').waitFor();await fits('Invoice preview at '+width);
  for(const size of ['58','80','a4'])await page.locator('#invoice-size').selectOption(size);
  const id=await page.locator('[data-edit-invoice]').getAttribute('data-edit-invoice');
  if(width===320){
   for(const [size,expected] of [['58',164.4],['80',226.8],['a4',595.3]]){
    const markup=await page.evaluate(async({id,size})=>{
     const d=await import('./src/db.mjs'),print=await import('./src/invoice.mjs');
     return print.completeInvoiceHtml((await d.summaryData()).orders.find(o=>o.id===id),size);
    },{id,size});
    const print=await context.newPage();
    await print.setContent(markup.replace('<script>','<script type="text/plain">'));
    const pdf=await print.pdf({path:path.join(scratch,size+'.pdf'),preferCSSPageSize:true});
    const media=pdf.toString('latin1').match(/\/MediaBox\s*\[0 0 ([\d.]+) /);
    assert.ok(media&&Math.abs(Number(media[1])-expected)<2,'Paper width '+size);
    await print.close();
   }
  }
  await page.locator('[data-edit-invoice]').click();
  await page.locator('.compact-bill-line summary').click();
  await page.locator('[data-line-field=qty]').fill('1');
  await page.locator('#save-bill').click();await page.locator('.invoice-preview').waitFor();
  await page.locator('[data-cancel-order]').click();
  await page.locator('[data-invoice="'+id+'"]').first().click();
  await page.getByText('CANCELLED INVOICE',{exact:true}).waitFor();
  const stock=await page.evaluate(async()=> (await (await import('./src/db.mjs')).all('catalog')).find(p=>p.size==='145/80 R12'&&p.model==='ZLX').stockQty);
  assert.equal(stock,12);assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('PASS: 320, 390, 768 and 1440 px, stock entry, dependent billing, edits and cancellation, update UI, keyboard-sized viewport and three PDF widths');
}finally{await browser.close();await new Promise(r=>server.close(r));}

