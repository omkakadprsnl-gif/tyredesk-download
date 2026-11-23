import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {all,buyTyres,cancelOrder,completeOrder,editOrder,exportBackup,getSetting,restoreBackup,saveSetting,setInventoryMode} from '../docs/app/src/db.mjs';
import {reconcile,rowKey} from '../docs/app/src/cloud-merge.mjs';
import {invoiceCSS,completeInvoiceHtml} from '../docs/app/src/invoice.mjs';
import {olderBackupNames} from '../docs/app/src/pwa-backup.mjs';

const buy=fields=>buyTyres({mode:'simple',brand:'MRF',qty:5,costPaise:300000,pricePaise:400000,...fields});
await saveSetting({name:'Inventory fixture',createdAt:'2026-11-22T00:00:00Z',gstRegistered:true});
const empty=await exportBackup();
await setInventoryMode('simple');
await Promise.all([buy({purchaseId:'first'}),buy({purchaseId:'first'})]);
await buy({brand:'  mrf  ',qty:3,costPaise:330000,supplier:'Second supplier',purchaseId:'second'});
assert.equal((await all('catalog')).length,1);
let [tyre]=await all('catalog');
assert.equal(tyre.stockQty,8);
assert.equal(tyre.model,'');
assert.equal(tyre.size,'');
assert.deepEqual((await all('purchases')).map(p=>p.costPaise),[300000,330000]);
await assert.rejects(setInventoryMode('detailed'),/permanent|fixed/i);

const item={name:'MRF',catalogId:tyre.id,type:'tyre',qty:2,unitPaise:tyre.pricePaise,taxBps:1800};
const input={requestId:'simple-bill',customerName:'Fixture',items:[item]};
const [a,b]=await Promise.all([completeOrder(input),completeOrder(input)]);
assert.equal(a.id,b.id);
assert.equal((await all('catalog'))[0].stockQty,6);
assert.equal(a.totals.taxPaise,144000);
await assert.rejects(completeOrder({...input,requestId:'exhausted',items:[{...item,qty:7}]}),/Insufficient stock/);
const edit={orderId:a.id,editToken:'correction-1',expectedEdit:'',items:[{...item,qty:3}],
 discount:{type:'fixed',value:10000},supplyMode:'intra',notes:'Quantity corrected'};
await Promise.all([editOrder(edit),editOrder(edit)]);
assert.equal((await all('catalog'))[0].stockQty,5);
assert.equal((await all('orders'))[0].previousVersions.length,1);
await assert.rejects(editOrder({...edit,editToken:'outdated'}),/changed/);
await cancelOrder(a.id,'Test cancellation');
await assert.rejects(cancelOrder(a.id),/already cancelled/);
assert.equal((await all('catalog'))[0].stockQty,8);
assert.equal((await all('inventoryMovements')).reduce((sum,m)=>sum+m.delta,0),8);
assert.match(completeInvoiceHtml(a,'58'),/58mm.*GST/s);
assert.match(invoiceCSS('80'),/size:80mm/);
assert.match(invoiceCSS('a4'),/size:A4/);

await restoreBackup(empty);
await setInventoryMode('detailed');
const first=await buy({mode:'detailed',model:'ZLX',size:'145/80 R12',purchaseId:'d1'});
await buy({mode:'detailed',brand:'mrf ',model:'zlx',size:'145 / 80r12',purchaseId:'d2'});
await buy({mode:'detailed',model:'ZLX',size:'165/80 R14',purchaseId:'variant'});
await buy({mode:'detailed',model:'ZVTV',size:'145/80 R12',purchaseId:'model'});
await assert.rejects(buy({mode:'detailed',model:'ZLX',size:''}),/brand, model and size/);
assert.equal((await all('catalog')).length,3);
assert.equal((await all('catalog')).find(p=>p.id===first.productId).stockQty,10);
assert.equal((await getSetting()).inventoryMode,'detailed');

const catalogKey=rowKey('catalog',first.productId);
[tyre]=await all('catalog');
const stock={...tyre,id:first.productId,stockQty:5,inventoryMode:'detailed',tyreIdentity:'["mrf","zlx","145/80r12"]'};
const move=(name,qty)=>({id:name,productId:stock.id,delta:qty,type:'purchase',balanceAfter:qty,createdAt:'2026-11-22'});
const base=new Map([[rowKey('settings','shop'),{id:'shop',inventoryMode:'detailed'}]]);
const remote=new Map([...base,[catalogKey,stock],[rowKey('inventoryMovements','remote'),move('remote',5)]]);
const local=new Map([...base,[catalogKey,{...stock,stockQty:7}],[rowKey('inventoryMovements','local'),move('local',7)]]);
const merged=reconcile(base,local,remote);
assert.equal(merged.get(catalogKey).stockQty,12);
assert.equal(merged.get(rowKey('inventoryMovements','local')).balanceAfter,12);
const snapshots=Array.from({length:20},(_,index)=>'TyreDesk-auto-2026-11-'+String(index+1).padStart(2,'0')+'.json');
const pruned=olderBackupNames([...snapshots,'TyreDesk-auto-2026-09-20.json','manual.json']);
assert.ok(pruned.includes(snapshots[0]));
assert.ok(!pruned.includes(snapshots.at(-1)));
assert.ok(!pruned.includes('TyreDesk-auto-2026-09-20.json')&&!pruned.includes('manual.json'));
console.log('PASS: inventory modes, concurrent purchases, invoice amendments and voids, print formats, cloud merge and backup retention');


