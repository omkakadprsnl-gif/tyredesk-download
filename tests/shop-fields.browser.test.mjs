import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import {chromium} from 'playwright';

const root=new URL('../docs/app/',import.meta.url);
const server=http.createServer(async(req,res)=>{
 try{
  const uri=new URL(req.url,'http://local').pathname;
  const name=uri.startsWith('/app/')?uri.slice(5):'index.html';
  const file=new URL(name||'index.html',root);
  if(!file.href.startsWith(root.href))return res.writeHead(404).end();
  res.setHeader('Content-Type',({mjs:'application/javascript',js:'application/javascript',css:'text/css',html:'text/html'})[name.split('.').at(-1)]||'application/octet-stream');
  res.end(await fs.readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch();
try{
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:820},hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:'+server.address().port+'/app/');
  await page.evaluate(async()=>{
   const d=await import('./src/db.mjs');
   await d.saveSetting({id:'shop',name:'Custom tyre screen test',
     inventoryMode:'detailed',inventoryModeLocked:true,tyreIdentitySchema:'field-based-v1',
     inventoryCategories:[{id:'tyres',name:'Tyres',fields:[
       {id:'field-model',label:'Color',stockKey:true},
       {id:'field-size',label:'Product Code',stockKey:true}
     ]}],createdAt:'2026-11-23',pinHash:'test',pinSalt:'00',gstRegistered:false});
   sessionStorage.setItem('tyredesk-unlocked','yes');
  });
  await page.reload();await page.locator('.shell').waitFor();
  const nav=async name=>{
   await page.evaluate(n=>document.querySelector('[data-nav="'+n+'"]').click(),name);
   await page.locator('[data-page="'+name+'"]').waitFor();
  };
  const pageFits=async name=>{
   const x=await page.evaluate(()=>({screen:document.documentElement.clientWidth,
    doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
   assert.ok(x.doc<=x.screen+1&&x.body<=x.screen+1,name+' '+JSON.stringify(x));
  };
  const modalFits=async name=>{
   const x=await page.evaluate(()=>{
    const footer=document.querySelector('.overlay .modal-footer').getBoundingClientRect();
    const modal=document.querySelector('.overlay .modal').getBoundingClientRect();
    const vv=window.visualViewport;
    return {footerBottom:footer.bottom,modalBottom:modal.bottom,vvBottom:vv.offsetTop+vv.height,
      footerLeft:footer.left,footerRight:footer.right,width:innerWidth};
   });
   assert.ok(x.footerBottom<=x.vvBottom+2&&x.modalBottom<=x.vvBottom+2,
     name+' footer/keyboard overflow '+JSON.stringify(x));
   assert.ok(x.footerLeft>=-2&&x.footerRight<=x.width+2,name+' horizontal modal overflow');
  };
  await nav('settings');
  assert.equal(await page.locator('#inventory-mode-form').count(),0,'Existing shop cannot change mode');
  assert.equal(await page.locator('[data-action=edit-category][data-category=tyres]').count(),0,
    'Permanent fields cannot be changed after onboarding');
  await nav('inventory');
  await page.locator('[data-action=buy-tyres]').click();
  assert.equal(await page.locator('#purchase-form [name=model]').count(),0);
  assert.equal(await page.locator('#purchase-form [name=size]').count(),0);
  const form=page.locator('#purchase-form');
  await form.locator('[name=brand]').fill('MRF');
  await form.locator('[name="attribute-field-model"]').fill('Red');
  await form.locator('[name="attribute-field-size"]').fill('A1');
  await form.locator('[name=qty]').fill('5');
  await form.locator('[name=cost]').fill('1000');
  await form.locator('[name=price]').fill('1500');
  await pageFits('Purchase screen width '+width);
  const layout=await page.evaluate(()=>{
   const root=document.querySelector('.purchase-dialog #purchase-form');
   return [...root.querySelectorAll('input:not([hidden])')].filter(n=>n.getBoundingClientRect().width>50).map(n=>({
      name:n.name,x:n.getBoundingClientRect().x,width:n.getBoundingClientRect().width}));
  });
  assert.ok(layout.every(n=>Math.abs(n.x-layout[0].x)<4&&Math.abs(n.width-layout[0].width)<4),
    'Purchasing inputs must align: '+JSON.stringify(layout));
  await form.locator('[name="attribute-field-size"]').focus();
  await page.setViewportSize({width,height:510});
  await modalFits('Purchasing keyboard at '+width);
  await page.setViewportSize({width,height:820});
  await page.locator('[form=purchase-form]').click();
  await page.locator('#purchase-form').waitFor({state:'detached'});
  await page.getByText('Color: Red',{exact:false}).first().waitFor();
  await nav('billing');
  const bill=page.locator('#tyre-bill-form');
  await bill.locator('[name=brand]').selectOption('MRF');
  await bill.locator('[name="stock-field-field-model"]').selectOption('Red');
  await bill.locator('[name="stock-field-field-size"]').selectOption('A1');
  assert.ok((await bill.getAttribute('data-product'))?.startsWith('tyre-'));
  await bill.locator('[name=qty]').fill('1');
  await bill.getByRole('button',{name:'Add tyre to bill'}).click();
  await page.getByText('Color: Red',{exact:false}).first().waitFor();
  await page.locator('[data-action=add-line]').click();
  const service=page.locator('.compact-bill-line').last();
  assert.equal(await service.locator('[data-line-field=qty]').count(),0,'Service quantity editor must not exist');
  assert.match(await service.locator('[data-line-caption]').innerText(),/Service charge/);
  await nav('expenses');
  await page.locator('[data-action=add-expense]').click();
  await page.locator('#expense-form [name=amount]').fill('1000');
  await page.setViewportSize({width,height:510});
  await modalFits('Expense keyboard at '+width);
  await page.setViewportSize({width,height:820});
  await page.locator('.modal-head [data-action=close-modal]').click();
  await nav('reminders');
  await page.locator('[data-action=add-reminder]').first().click();
  await page.locator('#reminder-form [name=title]').fill('Call tyre supplier');
  await page.setViewportSize({width,height:510});
  await modalFits('Reminder keyboard at '+width);
  await page.setViewportSize({width,height:820});
  await pageFits('Full app width '+width);
  assert.deepEqual(errors,[]);
  console.log('PASS: custom tyre purchasing/billing and mobile keyboard modal alignment at '+width+'px');
  await context.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
