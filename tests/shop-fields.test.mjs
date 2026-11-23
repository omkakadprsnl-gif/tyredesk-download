import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {saveSetting,getSetting,setInventoryMode,saveInventoryCategory,buyTyres,all,
        completeOrder,cancelOrder,exportBackup,restoreBackup} from '../docs/app/src/db.mjs';
import {tyreIdentity,tyreName,stockKeyFields,isVariantTyre} from '../docs/app/src/tyres.mjs';
import {mondayBackupDue} from '../docs/app/src/backup-reminder.mjs';

const fields=[{id:'field-model',label:'Color',stockKey:true},
 {id:'field-size',label:'Product Code',stockKey:true}];
await saveSetting({id:'shop',name:'One-time setup test',invoicePrefix:'SET',
 inventoryMode:'detailed',inventoryModeLocked:true,tyreIdentitySchema:'field-based-v1',
 inventoryCategories:[{id:'tyres',name:'Tyres',fields}],gstRegistered:false});
await assert.rejects(setInventoryMode('simple'),/permanent/i);
await assert.rejects(setInventoryMode('detailed'),/permanent/i);
await assert.rejects(saveInventoryCategory('tyres','Tyres',['Model','Size'],[0,1]),/fixed after shop setup/i);
assert.deepEqual(stockKeyFields(await getSetting()).map(f=>f.label),['Color','Product Code']);

const base={mode:'detailed',brand:'MRF',qty:5,costPaise:200000,pricePaise:350000};
const attrs=(color,code)=>({'field-model':color,'field-size':code});
const red=await buyTyres({...base,attributes:attrs('Red','A-1'),purchaseId:'red'});
const blue=await buyTyres({...base,qty:3,attributes:attrs('Blue','A-1'),purchaseId:'blue'});
assert.notEqual(red.productId,blue.productId,'Color distinguishes stock');
const plus=await buyTyres({...base,qty:2,attributes:attrs(' red ',' a-1 '),purchaseId:'red-more'});
assert.equal(plus.productId,red.productId,'Equivalent field values restock same SKU');
await assert.rejects(buyTyres({...base,purchaseId:'missing-code',attributes:attrs('Green','')}),/Separate tyre variants/);
assert.equal((await all('catalog')).length,2);
const products=await all('catalog'),redStock=products.find(p=>p.id===red.productId);
assert.equal(redStock.stockQty,7);
assert.equal(products.find(p=>p.id===blue.productId).stockQty,3);
assert.equal(redStock.model,'');
assert.equal(redStock.size,'');
assert.ok(isVariantTyre(redStock));
assert.match(tyreName(redStock,'detailed',await getSetting()),/Color: Red/);
assert.equal(JSON.parse(tyreIdentity('detailed',redStock,await getSetting()))[1],'custom');
assert.equal((await buyTyres({...base,purchaseId:'red',attributes:attrs('Red','A-1')})).productId,red.productId);
assert.equal((await all('catalog')).find(p=>p.id===red.productId).stockQty,7);
const receipt=await completeOrder({requestId:'sell-red',customerName:'Customer',
  items:[{name:tyreName(redStock,'detailed',await getSetting()),
    catalogId:red.productId,type:'tyre',qty:2,unitPaise:350000,taxBps:0}]});
assert.equal((await all('catalog')).find(p=>p.id===red.productId).stockQty,5);
assert.equal((await all('catalog')).find(p=>p.id===blue.productId).stockQty,3);
await cancelOrder(receipt.id,'Fixture cancellation');
assert.equal((await all('catalog')).find(p=>p.id===red.productId).stockQty,7);
const backup=await exportBackup();
await restoreBackup(backup);
const restored=await getSetting();
assert.equal(restored.inventoryMode,'detailed');
assert.equal(restored.tyreIdentitySchema,'field-based-v1');
assert.deepEqual(stockKeyFields(restored).map(f=>f.label),['Color','Product Code']);
assert.equal((await all('catalog')).length,2);

const monday=new Date(2026,10,23,9);
const sunday=new Date(2026,10,22,9);
const t={now:monday,dateKey:'2026-11-23',shopReady:true};
assert.equal(mondayBackupDue(t),true);
assert.equal(mondayBackupDue({...t,lastSaved:'2026-11-23T08:15:00Z'}),false);
assert.equal(mondayBackupDue({...t,dismissedDate:'2026-11-23'}),false);
assert.equal(mondayBackupDue({...t,shopReady:false}),false);
assert.equal(mondayBackupDue({...t,now:sunday,dateKey:'2026-11-22'}),false);
assert.equal(mondayBackupDue({...t,lastSaved:'2026-11-16'}),true);
console.log('PASS: one-time owner-selected tyre fields, variant separation, billing, restore and Monday Google Drive reminder');
