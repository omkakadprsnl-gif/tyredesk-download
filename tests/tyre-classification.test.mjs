import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {saveSetting,getSetting,saveInventoryCategory,addCatalogItem,buyTyres,
  completeOrder,editOrder,cancelOrder,all,exportBackup,restoreBackup} from '../docs/app/src/db.mjs';
import {tyreIdentity,tyreName,stockKeyFields,isVariantTyre,tyreSearchText} from '../docs/app/src/tyres.mjs';
import {reconcile,rowKey} from '../docs/app/src/cloud-merge.mjs';

await saveSetting({name:'Tyre Classification Test',createdAt:'2026-11-23',
  inventoryMode:'detailed',invoicePrefix:'TCT',gstRegistered:false});
const tyre={mode:'detailed',brand:'MRF',model:'ZLX',size:'185/65 R15',
  qty:5,costPaise:210000,pricePaise:320000};
const legacyPurchase=await buyTyres({...tyre,purchaseId:'legacy-001'});
const legacyId=legacyPurchase.productId;
const legacy=(await all('catalog')).find(p=>p.id===legacyId);
assert.equal(JSON.parse(legacy.tyreIdentity).length,3);
const originalStock=legacy.stockQty;

const oldCategory=await saveInventoryCategory('tyres','Tyres',['Load Index','Ply Rating']);
const [load,ply]=oldCategory.fields.map(f=>f.id);
assert.equal(stockKeyFields(await getSetting()).length,0);
await buyTyres({...tyre,qty:2,purchaseId:'legacy-002',attributes:{[load]:'88H'}});
assert.equal((await all('catalog')).length,1);
assert.equal((await all('catalog'))[0].stockQty,7);
assert.equal((await all('catalog'))[0].attributes[load],'88H');

const settings=await saveInventoryCategory('tyres','Tyres',['Load Index','Ply Rating'],[0]);
assert.deepEqual(settings.fields.filter(f=>f.stockKey).map(f=>f.id),[load]);
assert.equal((await all('catalog'))[0].tyreIdentity,legacy.tyreIdentity,
  'Enabling variants cannot rewrite existing stock identity or invoices');
await assert.rejects(
  buyTyres({...tyre,purchaseId:'blank-variant'}),
  /Complete every field/);
const p88=await buyTyres({...tyre,qty:3,purchaseId:'variant-88',
  attributes:{[load]:'88H',[ply]:'4'}});
const p92=await buyTyres({...tyre,qty:4,purchaseId:'variant-92',
  attributes:{[load]:'92V',[ply]:'6'}});
assert.notEqual(p88.productId,p92.productId);
assert.notEqual(p88.productId,legacyId);
assert.notEqual(p92.productId,legacyId);
const allNow=await all('catalog');
assert.equal(allNow.length,3);
assert.equal(allNow.reduce((s,p)=>s+p.stockQty,0),originalStock+2+3+4);
const new88=allNow.find(p=>p.id===p88.productId);
assert.equal(JSON.parse(new88.tyreIdentity).length,4);
assert.equal(new88.attributes[load],'88H');
assert.match(tyreName(new88,'detailed',await getSetting()),/Load Index: 88H/);
assert.match(tyreSearchText(new88,'detailed',await getSetting()),/88h/);
assert.ok(isVariantTyre(new88));

const twice=await buyTyres({...tyre,qty:3,purchaseId:'variant-88',
  attributes:{[load]:'88H'}});
assert.equal(twice.productId,p88.productId);
assert.equal((await all('catalog')).find(p=>p.id===p88.productId).stockQty,3);
const additional=await buyTyres({...tyre,qty:2,purchaseId:'variant-88-second',
  attributes:{[load]:' 88h '}});
assert.equal(additional.productId,p88.productId);
assert.equal((await all('catalog')).find(p=>p.id===p88.productId).stockQty,5);
assert.equal((await all('catalog')).find(p=>p.id===p92.productId).stockQty,4);
assert.equal((await all('catalog')).find(p=>p.id===legacyId).stockQty,7);

await assert.rejects(saveInventoryCategory('tyres','Tyres',['Load Index','Ply Rating'],[]),
  /locked after variants exist/);
await assert.rejects(saveInventoryCategory('tyres','Tyres',['Load Index','Ply Rating'],[0,1]),
  /locked after variants exist/);
const renamed=await saveInventoryCategory('tyres','Tyres',['Speed and Load','Ply Rating'],[0]);
assert.equal(renamed.fields[0].id,load);
assert.equal((await all('catalog')).find(p=>p.id===p88.productId).attributes[load],' 88h ');
assert.equal(stockKeyFields(await getSetting()).length,1);
await assert.rejects(addCatalogItem({...new88,attributes:{[load]:'100Z'}}),
  /Stock-identifying tyre fields cannot change/);

const currentLegacy=(await all('catalog')).find(p=>p.id===legacyId);
const reassigned=await addCatalogItem({...currentLegacy,attributes:{[load]:'84T'}});
assert.equal(reassigned.id,legacyId);
assert.ok(isVariantTyre(reassigned));
assert.equal(reassigned.stockQty,7);
await assert.rejects(addCatalogItem({...reassigned,attributes:{[load]:'92V'}}),
  /Stock-identifying tyre fields cannot change/);
const legacyRestock=await buyTyres({...tyre,existingId:legacyId,brand:'',model:'',size:'',
  qty:1,purchaseId:'restock-legacy-001'});
assert.equal(legacyRestock.productId,legacyId);
assert.equal((await all('catalog')).find(p=>p.id===legacyId).stockQty,8);

const bill=await completeOrder({requestId:'classification-bill',customerName:'Fixture',
  items:[{catalogId:p92.productId,type:'tyre',name:'MRF ZLX 92V',qty:2,unitPaise:320000,taxBps:0}]});
assert.equal((await all('catalog')).find(p=>p.id===p92.productId).stockQty,2);
assert.equal((await all('catalog')).find(p=>p.id===p88.productId).stockQty,5);
await editOrder({orderId:bill.id,editToken:'classification-edit',expectedEdit:'',
  items:[{catalogId:p92.productId,type:'tyre',name:'MRF ZLX 92V',qty:3,unitPaise:320000,taxBps:0}],
  discount:{type:'fixed',value:0},supplyMode:'intra',notes:'Variant edit'});
assert.equal((await all('catalog')).find(p=>p.id===p92.productId).stockQty,1);
await cancelOrder(bill.id,'Test cancellation');
assert.equal((await all('catalog')).find(p=>p.id===p92.productId).stockQty,4);

const backup=await exportBackup();
const before=JSON.parse(backup).payload.data;
assert.equal(before.settings[0].inventoryCategories[0].fields[0].stockKey,true);
await restoreBackup(backup);
const after=JSON.parse(await exportBackup()).payload.data;
assert.deepEqual(after.catalog,before.catalog);
assert.deepEqual(after.settings[0].inventoryCategories,before.settings[0].inventoryCategories);
assert.deepEqual(after.orders,before.orders);
assert.deepEqual(after.inventoryMovements,before.inventoryMovements);
const local=new Map([[rowKey('settings','shop'),await getSetting()],
  ...(await all('catalog')).map(p=>[rowKey('catalog',p.id),p])]);
const synced=reconcile(new Map(),local,new Map());
assert.equal([...synced.values()].filter(d=>d.type==='tyre').length,3);
console.log('PASS: owner-selected tyre dimensions, no merging, legacy stock classification, idempotency, billing, edit/cancel, backup and cloud merge');
