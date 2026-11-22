import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {saveSetting,getSetting,saveInventoryCategory,addCatalogItem,recordPurchase,adjustStock,
  completeOrder,editOrder,cancelOrder,all,exportBackup,restoreBackup,setInventoryMode,buyTyres} from '../docs/app/src/db.mjs';
import {inventoryCategories,productCategory,isStockProduct} from '../docs/app/src/tyres.mjs';
import {reconcile,rowKey} from '../docs/app/src/cloud-merge.mjs';

const failures=[];
async function check(name,fn){
  try{await fn();console.log('PASS: '+name);}
  catch(error){failures.push({name,error:error.stack||String(error)});console.error('FAIL: '+name+': '+error.message);}
}
await saveSetting({name:'CUSTOM CATEGORY AUDIT FIXTURE',createdAt:'2026-11-23T00:00:00Z',
  inventoryMode:'simple',gstRegistered:false,invoicePrefix:'AUD',pinHash:'fixture',pinSalt:'00'});

let category,prod,field0,field1,bill;
await check('Category creation and stable field identifiers',async()=>{
  category=await saveInventoryCategory(undefined,'Accessories',['Material','Diameter']);
  assert.equal(category.fields.length,2);
  assert.equal(inventoryCategories(await getSetting()).length,2);
  assert.equal(inventoryCategories(await getSetting())[0].id,'tyres');
  [field0,field1]=category.fields.map(f=>f.id);
  assert.equal(category.name,'Accessories');
  assert.equal(new Set([field0,field1]).size,2);
});
await check('Category validation and duplicate names',async()=>{
  await assert.rejects(saveInventoryCategory(undefined,'Accessories',['Color']),/already exists/);
  await assert.rejects(saveInventoryCategory(undefined,'New',Array(13).fill('A')),/up to 12/);
  await assert.rejects(saveInventoryCategory(undefined,'New',['Colour','colour']),/distinct/);
  await assert.rejects(saveInventoryCategory('not-a-category','X',[]),/no longer available/);
});
await check('Create an inventory product with user-defined attributes and opening stock',async()=>{
  await assert.rejects(addCatalogItem({type:'product',categoryId:'missing',name:'Invalid',pricePaise:10000}),/Choose a product category/);
  prod=await addCatalogItem({type:'product',categoryId:category.id,name:'Valve kit',openingStockQty:4,
    pricePaise:15000,costPaise:9000,attributes:{[field0]:'Brass',[field1]:'12mm'}});
  assert.equal(prod.type,'product');
  assert.equal(prod.stockQty,4);
  assert.equal(prod.attributes[field0],'Brass');
  assert.equal(prod.attributes[field1],'12mm');
  assert.equal(productCategory(await getSetting(),prod).id,category.id);
  assert.ok(isStockProduct(prod));
  const opened=(await all('inventoryMovements')).filter(m=>m.productId===prod.id&&m.type==='opening');
  assert.equal(opened.length,1);
});
await check('Rename fields without losing stored values, reject field deletion',async()=>{
  const newer=await saveInventoryCategory(category.id,'Parts',['Metal','Diameter','Finish']);
  assert.equal(newer.fields[0].id,field0);
  assert.equal(newer.fields[1].id,field1);
  assert.equal(newer.fields.length,3);
  assert.equal((await all('catalog')).find(p=>p.id===prod.id).attributes[field0],'Brass');
  await assert.rejects(saveInventoryCategory(category.id,'Parts',['Metal']),/Existing fields must keep/);
  category=newer;
});
await check('Restock idempotency, stock adjustment and no negative stock',async()=>{
  const stock=()=>all('catalog').then(a=>a.find(p=>p.id===prod.id).stockQty);
  const [a,b]=await Promise.all([
    recordPurchase({productId:prod.id,qty:5,costPaise:8000,purchaseId:'same-order'}),
    recordPurchase({productId:prod.id,qty:5,costPaise:8000,purchaseId:'same-order'})
  ]);
  assert.equal(a.id,b.id);
  assert.equal(await stock(),9);
  assert.equal((await all('purchases')).filter(p=>p.id==='same-order').length,1);
  await adjustStock(prod.id,-1,'Test count');
  assert.equal(await stock(),8);
  await assert.rejects(adjustStock(prod.id,-9,'Invalid decrease'),/Insufficient stock/);
  assert.equal(await stock(),8);
});
await check('Custom-category product billing, edit, cancellation and stock conservation',async()=>{
  const line=(qty)=>({catalogId:prod.id,name:'Valve kit',type:'product',qty,unitPaise:15000,taxBps:0});
  bill=await completeOrder({requestId:'custom-bill-001',customerName:'Fixture Customer',items:[line(2)]});
  assert.equal((await all('catalog')).find(p=>p.id===prod.id).stockQty,6);
  const twice=await completeOrder({requestId:'custom-bill-001',customerName:'Fixture Customer',items:[line(2)]});
  assert.equal(twice.id,bill.id);
  assert.equal((await all('catalog')).find(p=>p.id===prod.id).stockQty,6);
  await assert.rejects(completeOrder({requestId:'oversell',customerName:'Fixture',items:[line(7)]}),/Insufficient stock/);
  const updated=await editOrder({orderId:bill.id,editToken:'edit-custom-001',expectedEdit:'',items:[line(3)],
    discount:{type:'fixed',value:0},supplyMode:'intra',notes:'Audit edit'});
  assert.equal(updated.items.length,1);
  assert.equal((await all('catalog')).find(p=>p.id===prod.id).stockQty,5);
  await cancelOrder(bill.id,'Audit void');
  assert.equal((await all('catalog')).find(p=>p.id===prod.id).stockQty,8);
  assert.equal((await all('orders')).length,1);
  assert.equal((await all('orders'))[0].status,'cancelled');
});
await check('Backup and restore round trip preserves categories, attributes and stock',async()=>{
  const original=await exportBackup();
  const before=JSON.parse(original).payload.data;
  assert.equal(before.settings[0].inventoryCategories.length,1);
  await restoreBackup(original);
  const next=await exportBackup();
  const after=JSON.parse(next).payload.data;
  assert.deepEqual(after.settings[0].inventoryCategories,before.settings[0].inventoryCategories);
  assert.deepEqual(after.catalog,before.catalog);
  assert.deepEqual(after.purchases,before.purchases);
  assert.deepEqual(after.inventoryMovements,before.inventoryMovements);
  assert.deepEqual(after.orders,before.orders);
});
await check('Custom tyre fields coexist with Simple inventory and tyre restocking',async()=>{
  const tyreCategory=await saveInventoryCategory('tyres','Tyres',['Load Index']);
  const id=tyreCategory.fields[0].id;
  await buyTyres({mode:'simple',brand:'MRF',qty:2,costPaise:100000,pricePaise:150000,
    purchaseId:'mrf-one',attributes:{[id]:'95H'}});
  await buyTyres({mode:'simple',brand:' mrf ',qty:2,costPaise:100000,pricePaise:150000,
    purchaseId:'mrf-two',attributes:{[id]:'95H'}});
  const tyres=(await all('catalog')).filter(p=>p.type==='tyre');
  assert.equal(tyres.length,1);
  assert.equal(tyres[0].stockQty,4);
  assert.equal(tyres[0].attributes[id],'95H');
});
await check('Cloud reconciliation retains product data and shop-defined categories',async()=>{
  const settings=await getSetting();
  const product=(await all('catalog')).find(p=>p.id===prod.id);
  const base=new Map();
  const local=new Map([[rowKey('settings','shop'),settings],[rowKey('catalog',prod.id),product]]);
  const result=reconcile(base,local,new Map());
  assert.deepEqual(result.get(rowKey('settings','shop')).inventoryCategories,settings.inventoryCategories);
  assert.deepEqual(result.get(rowKey('catalog',prod.id)).attributes,product.attributes);
});
console.log('CUSTOM_CATEGORY_AUDIT_RESULT',JSON.stringify({passed:9-failures.length,failed:failures.length,failures:failures.map(f=>f.name)}));
if(failures.length){for(const f of failures)console.error(f.error);process.exitCode=1;}
