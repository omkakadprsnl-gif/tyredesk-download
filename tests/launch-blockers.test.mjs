import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {addPayment,all,completeOrder,exportBackup,packAndroidBackup,put,restoreBackup,
  saveReceivedDraft,saveSetting,summaryData} from '../docs/app/src/db.mjs';

await saveSetting({name:'Launch audit fixture',inventoryMode:'simple',createdAt:'2026-11-22T00:00:00Z'});
const item={name:'Alignment',type:'service',qty:1,unitPaise:50000};
const a=await completeOrder({customerName:'Fixture customer',items:[item]});
const b=await completeOrder({customerId:a.customerId,items:[item]});
await addPayment(a.id,50000,'upi','audit-transfer','first');
assert.equal((await addPayment(a.id,50000,'upi','audit-transfer','first')).amountPaise,50000);
await assert.rejects(addPayment(b.id,50000,'upi',' AUDIT-TRANSFER ','second'),/already been recorded/);
await assert.rejects(completeOrder({customerId:a.customerId,items:[item],paidPaise:50000,
  paymentMethod:'upi',paymentReference:'AUDIT-TRANSFER'}),/already been recorded/);
await saveReceivedDraft({requestId:'first-draft',draftReceipts:[{id:'draft-payment',amountPaise:50000,reference:'DRAFT-UTR'}]});
await assert.rejects(saveReceivedDraft({requestId:'other-draft',
  draftReceipts:[{id:'other-payment',amountPaise:50000,reference:'draft-utr'}]}),/another bill draft/);
await assert.rejects(addPayment(b.id,50000,'upi','DRAFT-UTR'),/another bill draft/);
await completeOrder({requestId:'first-draft',customerId:a.customerId,items:[item],
  draftReceipts:[{id:'draft-payment',amountPaise:50000,reference:'DRAFT-UTR',createdAt:new Date().toISOString()}]});
assert.equal((await all('payments')).length,2);

const dashboard=await summaryData({dashboard:true});
const full=await summaryData();
assert.deepEqual(dashboard.orders,full.orders);
assert.equal(dashboard.customerCount,full.customers.length);
assert.equal(dashboard.customers.length,0);
await addPayment(b.id,20000,'cash');
assert.equal((await summaryData({dashboard:true})).orders.find(order=>order.id===b.id).duePaise,30000);

const small=await exportBackup();
assert.equal(await packAndroidBackup(small),small);
const note='TyreDesk backup test ₹ '.repeat(1_000_000);
await put('audit',{id:'large-history',note});
const plain=await exportBackup();
const packed=await packAndroidBackup(plain);
assert.ok(plain.length>20_000_000 && packed.length<20_000_000);
const damaged=JSON.parse(packed);
damaged.payload.archive=damaged.payload.archive.slice(1);
await assert.rejects(restoreBackup(JSON.stringify(damaged)),/checksum failed/);
await restoreBackup(packed);
assert.equal((await all('audit')).find(row=>row.id==='large-history').note,note);
assert.equal((await all('orders')).length,3);
assert.equal((await all('payments')).length,3);
await assert.rejects(addPayment(b.id,10000,'upi','audit-transfer'),/already been recorded/);
console.log('PASS: shop-wide UPI uniqueness, dashboard cache invalidation, oversized Android backup and lossless restore');
