import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium} from 'playwright';

const root=new URL('../docs/app/',import.meta.url);
const types={mjs:'application/javascript',js:'application/javascript',html:'text/html',css:'text/css'};
const server=http.createServer(async(req,res)=>{
 try{
  const route=new URL(req.url,'http://local').pathname;
  const name=route.startsWith('/app/')?route.slice(5):'';
  const filename=name||'index.html';
  const target=new URL(filename,root);
  if(!target.href.startsWith(root.href))return res.writeHead(404).end();
  res.setHeader('Content-Type',types[path.extname(filename).slice(1)]||'application/octet-stream');
  res.end(await fs.readFile(target));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch();
const address='http://127.0.0.1:'+server.address().port+'/app/';
try{
 for(const width of [320,390,768]){
  const context=await browser.newContext({viewport:{width,height:820},hasTouch:width<=390,serviceWorkers:'block'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(address);
  await page.evaluate(async()=>{
   const db=await import('./src/db.mjs');
   await db.saveSetting({name:'Custom UI fixture',createdAt:'2026-11-23T00:00:00Z',
     owner:'Audit',phone:'0000000000',inventoryMode:'simple',gstRegistered:false,
     pinHash:'fixture',pinSalt:'00'});
   sessionStorage.setItem('tyredesk-unlocked','yes');
  });
  await page.reload();await page.waitForSelector('.shell');
  const nav=async n=>{
   await page.evaluate(n=>document.querySelector('[data-nav="'+n+'"]').click(),n);
   await page.locator('[data-page='+n+']').waitFor();
  };
  const fits=async label=>{
   const dims=await page.evaluate(()=>({screen:document.documentElement.clientWidth,body:document.body.scrollWidth,doc:document.documentElement.scrollWidth}));
   assert.ok(dims.body<=dims.screen+1&&dims.doc<=dims.screen+1,label+': '+JSON.stringify(dims));
  };
  await nav('settings');
  await page.getByRole('button',{name:'Add category'}).click();
  await page.locator('#category-form [name=name]').fill('Accessories');
  await page.locator('#category-form [name=field]').first().fill('Material');
  await page.locator('[data-action=add-category-field]').click();
  await page.locator('#category-form [name=field]').last().fill('Diameter');
  await fits('Category modal at '+width);
  await page.locator('[form=category-form]').click();
  await page.locator('#category-form').waitFor({state:'detached'});
  const fieldIds=await page.evaluate(async()=>{
   const shop=await (await import('./src/db.mjs')).getSetting();
   const category=shop.inventoryCategories.find(c=>c.name==='Accessories');
   return {id:category.id,fields:category.fields.map(f=>f.id)};
  });
  assert.equal(fieldIds.fields.length,2);
  await nav('inventory');
  await page.locator('[data-action=edit-stock-product][data-category="'+fieldIds.id+'"]').click();
  await page.locator('#custom-product-form [name=name]').fill('Valve kit');
  await page.locator('#custom-product-form [name=stock]').fill('4');
  await page.locator('#custom-product-form [name=cost]').fill('90');
  await page.locator('#custom-product-form [name=price]').fill('150');
  await page.locator('#custom-product-form [name=attribute-'+fieldIds.fields[0]+']').fill('Steel');
  await page.locator('#custom-product-form [name=attribute-'+fieldIds.fields[1]+']').fill('12mm');
  await fits('Product modal at '+width);
  await page.locator('[form=custom-product-form]').click();
  await page.locator('#custom-product-form').waitFor({state:'detached'});
  const product=await page.evaluate(async()=>{
   return (await (await import('./src/db.mjs')).all('catalog')).find(p=>p.type==='product');
  });
  assert.equal(product.stockQty,4);
  assert.equal(product.attributes[fieldIds.fields[0]],'Steel');
  await page.locator('[data-stock-in="'+product.id+'"]').click();
  await page.locator('#custom-restock-form [name=qty]').fill('2');
  await page.locator('#custom-restock-form [name=cost]').fill('85');
  await page.locator('[form=custom-restock-form]').click();
  await page.locator('#custom-restock-form').waitFor({state:'detached'});
  assert.equal(await page.evaluate(async id=>(await (await import('./src/db.mjs')).all('catalog')).find(p=>p.id===id).stockQty,product.id),6);
  await nav('billing');
  await page.locator('#bill-product').selectOption(product.id);
  assert.equal(await page.locator('#bill-lines .compact-bill-line').count(),1);
  await page.locator('#bill-customer-name').fill('Category audit customer');
  await page.locator('#save-bill').click();
  await page.locator('.invoice-preview').waitFor();
  const state=await page.evaluate(async id=>{
   const db=await import('./src/db.mjs');
   return {qty:(await db.all('catalog')).find(p=>p.id===id).stockQty,orders:(await db.all('orders')).length};
  },product.id);
  assert.deepEqual(state,{qty:5,orders:1});
  await fits('Invoice preview at '+width);
  assert.deepEqual(errors,[],'Browser JavaScript errors at '+width);
  console.log('PASS: custom category, fields, product, restock and invoice at '+width+'px');
  await context.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
