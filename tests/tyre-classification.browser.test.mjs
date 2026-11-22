import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../docs/app/',import.meta.url);
const server=http.createServer(async(req,res)=>{
 try {
  const uri=new URL(req.url,'http://local').pathname;
  const name=uri.startsWith('/app/')?uri.slice(5):'index.html';
  const file=new URL(name||'index.html',root);
  if(!file.href.startsWith(root.href))return res.writeHead(404).end();
  const ext=file.pathname.split('.').at(-1);
  res.setHeader('Content-Type',({mjs:'application/javascript',html:'text/html',css:'text/css',js:'application/javascript'})[ext]||'application/octet-stream');
  res.end(await fs.readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch();
try{
 for(const width of [320,390,768]){
  const context=await browser.newContext({viewport:{width,height:820},hasTouch:width<500,serviceWorkers:'block'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:'+server.address().port+'/app/');
  await page.evaluate(async()=>{
   const d=await import('./src/db.mjs');
   await d.saveSetting({name:'Tyre Variant UI Fixture',createdAt:'2026-11-23',
     inventoryMode:'detailed',pinHash:'test',pinSalt:'00',gstRegistered:false});
   sessionStorage.setItem('tyredesk-unlocked','yes');
  });
  await page.reload();await page.locator('.shell').waitFor();
  const nav=async name=>{
   await page.evaluate(n=>document.querySelector('[data-nav="'+n+'"]').click(),name);
   await page.locator('[data-page="'+name+'"]').waitFor();
  };
  const fits=async label=>{
   const dims=await page.evaluate(()=>({width:document.documentElement.clientWidth,
     doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
   assert.ok(dims.doc<=dims.width+1&&dims.body<=dims.width+1,label+' '+JSON.stringify(dims));
  };
  await nav('settings');
  await page.locator('[data-action=edit-category][data-category=tyres]').click();
  await page.locator('#category-form [name=field]').first().fill('Load Index');
  await page.locator('#category-form [name=stockKeyIndex]').first().check();
  await fits('Settings field editor at '+width);
  await page.locator('[form=category-form]').click();
  await page.locator('#category-form').waitFor({state:'detached'});
  const field=await page.evaluate(async()=>{
   const s=await (await import('./src/db.mjs')).getSetting();
   return s.inventoryCategories[0].fields[0];
  });
  assert.equal(field.stockKey,true);
  const variants=await page.evaluate(async id=>{
   const d=await import('./src/db.mjs');
   const base={mode:'detailed',brand:'MRF',model:'ZLX',size:'185/65 R15',
     qty:5,costPaise:140000,pricePaise:210000};
   const first=await d.buyTyres({...base,purchaseId:'variant-ui-88',attributes:{[id]:'88H'}});
   const second=await d.buyTyres({...base,purchaseId:'variant-ui-92',attributes:{[id]:'92V'}});
   return {first:first.productId,second:second.productId};
  },field.id);
  assert.notEqual(variants.first,variants.second);
  await nav('inventory');
  await page.getByText('Load Index: 88H',{exact:false}).first().waitFor();
  await page.getByText('Load Index: 92V',{exact:false}).first().waitFor();
  await fits('Inventory variant list at '+width);
  await page.locator('#page-search').fill('92V');
  assert.equal(await page.locator('.inventory-actions [data-restock]').count(),1);
  await page.locator('#page-search').fill('');
  await page.locator('[data-action=buy-tyres]').click();
  await page.locator('[name=attribute-'+field.id+']').first().waitFor();
  await fits('Purchasing a classified tyre at '+width);
  await page.locator('[data-action=close-modal]').first().click();
  await nav('billing');
  const picker=page.locator('#tyre-bill-form');
  await picker.locator('[name=brand]').selectOption('MRF');
  await picker.locator('[name=model]').selectOption('ZLX');
  await picker.locator('[name=size]').selectOption('185/65 R15');
  const select=picker.locator('[data-stock-field="'+field.id+'"]');
  await select.waitFor();
  assert.deepEqual((await select.locator('option').allTextContents()).slice(1).sort(),['88H','92V']);
  assert.equal(await picker.locator('[name=exact]').isVisible(),true);
  assert.equal(await picker.getByRole('button',{name:'Add tyre to bill'}).isDisabled(),true);
  await select.selectOption('92V');
  assert.equal(await picker.getAttribute('data-product'),variants.second);
  await picker.locator('[name=qty]').fill('2');
  await picker.getByRole('button',{name:'Add tyre to bill'}).click();
  await page.getByText('Load Index: 92V',{exact:false}).first().waitFor();
  await page.locator('#bill-customer-name').fill('Variant customer');
  await page.locator('#save-bill').click();
  await page.locator('.invoice-preview').waitFor();
  const data=await page.evaluate(async()=> {
   const d=await import('./src/db.mjs'),catalog=await d.all('catalog'),orders=await d.all('orders');
   const backup=JSON.parse(await d.exportBackup());
   return {catalog:catalog.map(p=>({id:p.id,qty:p.stockQty})),
     orders:orders.map(o=>({items:o.items,totals:o.totals})),
     backedUpFields:backup.payload.data.settings[0].inventoryCategories[0].fields};
  });
  assert.equal(data.catalog.find(p=>p.id===variants.first).qty,5);
  assert.equal(data.catalog.find(p=>p.id===variants.second).qty,3);
  assert.equal(data.orders.length,1);
  assert.match(data.orders[0].items[0].name,/92V/);
  assert.equal(data.backedUpFields[0].stockKey,true);
  await fits('Invoice preview at '+width);
  assert.deepEqual(errors,[]);
  console.log('PASS: tyre classification UI, search, variant choice, billing, backed-up fields at '+width+'px');
  await context.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
