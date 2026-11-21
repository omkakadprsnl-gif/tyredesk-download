import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../docs/',import.meta.url));
const server=http.createServer(async(req,res)=>{try{let p=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname));if((await fs.stat(p)).isDirectory())p=path.join(p,'index.html');const body=await fs.readFile(p);res.setHeader('Content-Type',({'.mjs':'application/javascript','.js':'application/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(p)]||'application/octet-stream');res.end(body);}catch{res.statusCode=404;res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.env.TYREDESK_TEST_URL||`http://127.0.0.1:${server.address().port}/app/`;
const browser=await chromium.launch({headless:true});
const desktop=process.env.TYREDESK_DESKTOP==='1';
const viewport=desktop?{width:1440,height:1000}:{width:390,height:844};
const context=await browser.newContext({viewport,deviceScaleFactor:1});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const read=()=>page.evaluate(async()=>{const db=await import('./src/db.mjs');return db.summaryData();});
const nav=async name=>{await page.evaluate(n=>document.querySelector(`[data-nav="${n}"]`).click(),name);await page.waitForSelector(`[data-page="${name}"]`);};
try{
 await page.goto(base);await page.waitForSelector('#setup-form');
 assert.equal(await page.locator('[name=legalConsent]').isChecked(),false);
 for(const [n,v] of Object.entries({name:'Test Tyres',owner:'Test Owner',phone:'9999999999',pin:'1234',confirmPin:'1234'}))await page.locator(`#setup-form [name=${n}]`).fill(v);
 await page.locator('#setup-form button[type=submit]').click();assert.equal((await read()).settings,undefined);
 await page.locator('[name=legalConsent]').check();await page.locator('#setup-form button[type=submit]').click();await page.waitForSelector('.shell');assert.equal((await read()).settings.legalConsent.termsVersion,'2026-11-21.2');
 // Create, edit and complete a reminder through the UI.
 await page.locator('[data-action=add-reminder]').click();await page.locator('#reminder-form [name=title]').fill('Call supplier');await page.locator('#reminder-form [name=notes]').fill('Check delivery');await page.locator('#reminder-form [name=due]').fill('2020-01-01T10:30');await page.locator('[form=reminder-form]').click();await page.waitForSelector('.reminder-bell.is-alert');
 await nav('reminders');await page.locator('[data-action=edit-reminder]').click();await page.locator('#reminder-form [name=title]').fill('Call supplier today');await page.locator('[form=reminder-form]').click();await page.waitForFunction(()=>document.querySelector('.reminder-row-info strong')?.textContent==='Call supplier today');await page.locator('[data-action=complete-reminder]').click();await page.waitForFunction(()=>!document.querySelector('.reminder-row'));assert.equal((await read()).reminders.length,0);
 // Seed an unpaid bill through the same DB API, then exercise the QR UI.
 const id=await page.evaluate(async()=>{const db=await import('./src/db.mjs');return (await db.completeOrder({customerName:'Customer',items:[{name:'Alignment',qty:1,type:'service',unitPaise:100000}],paidPaise:0})).id;});
 await page.reload();await page.waitForSelector('.shell');await nav('sales');await page.locator(`[data-invoice="${id}"]`).first().click();await page.locator('[data-action=show-payment-qr]').click();await page.waitForSelector('[data-action=qr-settings]');assert.equal((await read()).payments.length,0);
 await page.locator('[data-action=qr-settings]').click();await page.locator('[name=paymentQr]').setInputFiles(path.join(root,'app/assets/icon-512.png'));await page.locator('#settings-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('.qr-settings-preview')!==null);
 await nav('sales');await page.locator(`[data-invoice="${id}"]`).first().click();await page.locator('[data-action=show-payment-qr]').click();await page.waitForSelector('.payment-qr-display img');assert.equal((await read()).payments.length,0);
 const bounds=await page.locator('.payment-qr-display img').boundingBox();assert.ok(bounds.width>240&&bounds.width<=Math.min(440,viewport.width),'QR readable on mobile');
 await fs.mkdir(new URL('../../screenshots/',import.meta.url),{recursive:true});await page.screenshot({path:fileURLToPath(new URL('../../screenshots/payment-qr.png',import.meta.url)),fullPage:true});
 await page.locator('#qr-payment-form [name=amount]').fill('300');await page.locator('#qr-payment-form [name=verified]').check();await page.locator('[form=qr-payment-form]').click();await page.waitForFunction(async()=>{const d=await import('./src/db.mjs');return (await d.all('payments')).length===1;});assert.equal((await read()).orders[0].duePaise,70000);
 await page.locator('[data-action=show-payment-qr]').click();await page.locator('#qr-payment-form [name=verified]').check();await page.locator('[form=qr-payment-form]').click();await page.waitForFunction(async()=>{const d=await import('./src/db.mjs');return (await d.all('payments')).length===2;});await page.locator('[data-action=show-payment-qr]').click();assert.equal(await page.locator('[form=qr-payment-form]').count(),0);assert.equal((await read()).orders[0].duePaise,0);await page.locator('[data-action=close-modal]').first().click();
 // A real draft shows the QR immediately and keeps the receipt local until the owner saves.
 await nav('billing');await page.locator('#bill-customer-name').fill('Draft QR customer');
 await page.locator('[data-action=add-line]').click();await page.locator('[data-line-field=name]').last().fill('Draft service');await page.locator('[data-line-field=unitPaise]').last().fill('150');
 await page.waitForSelector('.draft-qr img');assert.equal((await read()).orders.length,1);assert.equal((await read()).payments.length,2);
 await page.locator('[data-action=draft-payment]').click();await page.locator('#draft-payment-form [name=amount]').fill('100');await page.locator('#draft-payment-form [name=verified]').check();await page.locator('[form=draft-payment-form]').click();
 await page.waitForFunction(()=>document.querySelector('.draft-qr h3')?.textContent.includes('50'));assert.equal((await read()).payments.length,2);
 await page.reload();await nav('billing');assert.equal(await page.locator('#bill-customer-name').inputValue(),'Draft QR customer');await page.locator('#save-bill').click();
 await page.waitForFunction(async()=>((await (await import('./src/db.mjs')).all('orders')).length===2));
 const draft=(await read()).orders.find(o=>o.customerSnapshot.name==='Draft QR customer');assert.equal(draft.duePaise,5000);assert.equal((await read()).payments.filter(p=>p.orderId===draft.id).length,1);
 await page.locator('[data-action=close-modal]').first().click();
 // Generate a valid one-page supplier PDF, then import through the file picker.
 const content='BT /F1 12 Tf 50 750 Td (MRF 185/65 R15 4 3000.00 12000.00) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
 let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const x=pdf.length;pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
 await nav('inventory');await page.locator('[data-action=import-supplier-pdf]').click();await page.locator('#supplier-pdf-file').setInputFiles({name:'supplier.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)});await page.waitForSelector('[data-supplier-row]');assert.equal(await page.locator('[name=qty]').inputValue(),'4');assert.equal(await page.locator('[name=cost]').inputValue(),'3000.00');
 await page.locator('[name=supplier]').fill('Supplier');await page.locator('[name=invoiceReference]').fill('S-100');await page.locator('[name=price]').fill('5000');await page.locator('[name=reviewed]').check();await page.locator('#supplier-confirm').click();await page.waitForFunction(async()=>{const d=await import('./src/db.mjs');return (await d.all('purchases')).length===1;});assert.equal((await read()).catalog[0].stockQty,4);
 await page.evaluate(async()=>{const d=await import('./src/db.mjs');const backup=await d.exportBackup();await d.restoreBackup(backup);});assert.ok((await read()).settings.paymentQrData);assert.equal((await read()).purchases.length,1);
 // Shell, legal pages and supplier PDF reader must work offline after activation.
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.waitForSelector('.shell');await nav('inventory');await page.locator('[data-action=import-supplier-pdf]').click();await page.locator('#supplier-pdf-file').setInputFiles({name:'supplier.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)});await page.waitForSelector('[data-supplier-row]');await page.locator('[data-action=close-modal]').first().click();await page.goto(base+'terms.html');assert.match(await page.textContent('h1'),/Terms/);await page.goto(base+'privacy.html');assert.match(await page.textContent('h1'),/Privacy/);
 assert.deepEqual(errors,[]);console.log((desktop?'Desktop':'Mobile')+' setup consent, reminders, QR display/partial/full payment, PDF extraction/import, backup and offline legal/PDF: PASS');
}finally{await browser.close();await new Promise(r=>server.close(r));}
