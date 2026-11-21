import {uid, normalizePhone, normalizeVehicle, safeText, calculateBill, calculateDue, todayISO} from './logic.mjs';

const DB_NAME='tyreflow-offline-v1';
const DB_VERSION=6;
export const STORES = ['settings','customers','vehicles','catalog','orders','payments','expenses','audit','meta','inventoryMovements','purchases','reminders'];
let dbPromise;
const request = req => new Promise((resolve,reject) => { req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
export function getDatabase(){
  if(!dbPromise) dbPromise = new Promise((resolve,reject)=>{
    const open=indexedDB.open(DB_NAME,7);
    open.onupgradeneeded=(event)=>{
      const db=open.result;
      const add=(store,defs=[])=>{ if(!db.objectStoreNames.contains(store)){const obj=db.createObjectStore(store,{keyPath:'id'}); defs.forEach(([n,k,u])=>obj.createIndex(n,k,{unique:!!u}));} };
      add('settings');
      add('customers',[['searchName','searchName'],['phoneNorm','phoneNorm'],['createdAt','createdAt']]);
      add('vehicles',[['regNorm','regNorm'],['customerId','customerId']]);
      add('catalog',[['type','type'],['searchName','searchName']]);
      add('orders',[['number','number',true],['customerId','customerId'],['createdAt','createdAt'],['requestId','requestId',true]]);
      add('payments',[['orderId','orderId'],['createdAt','createdAt']]);
      add('expenses',[['date','date'],['createdAt','createdAt']]);
      add('audit',[['createdAt','createdAt']]);
      add('meta'); add('cloudState'); add('cloudBase');
      add('inventoryMovements',[['productId','productId'],['createdAt','createdAt']]);
      add('purchases',[['productId','productId'],['createdAt','createdAt']]);
      add('reminders',[['dueAt','dueAt']]);
      // Older versions had an optional stock checkbox. All tyre products now track stock.
      // Keep recorded quantities unchanged; missing quantities become zero until counted.
      if(event.oldVersion<5){
        const catalog=open.transaction.objectStore('catalog');
        catalog.openCursor().onsuccess=e=>{
          const cursor=e.target.result;
          if(!cursor)return;
          const item=cursor.value;
          const required=item.type==='tyre';
          if(item.trackStock!==required){
            item.trackStock=required;
            if(required && !Number.isSafeInteger(item.stockQty))item.stockQty=0;
            cursor.update(item);
          }
          cursor.continue();
        };
      }
    };
    open.onsuccess=()=>{const db=open.result;db.onversionchange=()=>{db.close();dbPromise=null;};resolve(db);};
    open.onerror=()=>reject(open.error);open.onblocked=()=>reject(new Error('Close other app tabs before upgrading database.'));
  });
  return dbPromise;
}
export async function transact(storeNames,mode,fn){
  const db=await getDatabase();
  const tracked=mode==='readwrite'&&!storeNames.includes('cloudState')&&storeNames.some(s=>s!=='audit');
  const tx=db.transaction(tracked?[...storeNames,'cloudState']:storeNames,mode);
  let result; let finished=false;
  const complete=new Promise((resolve,reject)=>{ tx.oncomplete=()=>{finished=true;resolve();};tx.onerror=()=>reject(tx.error||new Error('Storage error'));tx.onabort=()=>reject(tx.error||new Error('Transaction cancelled')); });
  try {result=await fn(tx);
    if(tracked){const s=tx.objectStore('cloudState'),d=await request(s.get('device'));if(d)await request(s.put({...d,generation:d.generation+1}));}} catch(err) {try{if(!finished)tx.abort();}catch{} await complete.catch(()=>{});throw err;}
  await complete;
  return result;
}
export const get = async (store,id)=>transact([store],'readonly',tx=>request(tx.objectStore(store).get(id)));
export const all = async (store)=>transact([store],'readonly',tx=>request(tx.objectStore(store).getAll()));
export const put = async (store,value)=>transact([store],'readwrite',tx=>request(tx.objectStore(store).put(value)));
export async function remove(store,id) {return transact([store],'readwrite',tx=>request(tx.objectStore(store).delete(id)));}
export async function getSetting(){return get('settings','shop');}
export async function saveSetting(value){return put('settings',{...value,id:'shop',updatedAt:new Date().toISOString()});}
export async function addAudit(action,detail='') {return put('audit',{id:uid(),createdAt:new Date().toISOString(),action,detail});}
export async function searchCustomers(term,limit=20){
  const q=String(term||'').trim().toLowerCase();if(!q)return [];
  const phone=normalizePhone(q), vehicle=normalizeVehicle(q);
  const db=await getDatabase();
  let customers=[];
  if(phone.length>=3){customers=await transact(['customers'],'readonly',tx=>request(tx.objectStore('customers').index('phoneNorm').getAll(IDBKeyRange.bound(phone,phone+'\uffff'),limit)));}
  if(q.length>=2){const names=await transact(['customers'],'readonly',tx=>request(tx.objectStore('customers').index('searchName').getAll(IDBKeyRange.bound(q,q+'\uffff'),limit))); customers.push(...names);}
  if(vehicle.length>=3){const vehicleMatches=await transact(['vehicles'],'readonly',tx=>request(tx.objectStore('vehicles').index('regNorm').getAll(IDBKeyRange.bound(vehicle,vehicle+'\uffff'),limit))); const vCustomers=await Promise.all(vehicleMatches.map(v=>get('customers',v.customerId)));customers.push(...vCustomers.filter(Boolean));}
  const found=[...new Map(customers.map(c=>[c.id,c])).values()].slice(0,limit);
  const veh=await all('vehicles');
  return found.map(c=>({...c,vehicles:veh.filter(v=>v.customerId===c.id)}));
}
export async function upsertCustomer(payload){
  const id=payload.id||uid();const now=new Date().toISOString();
  const original=await get('customers',id);
  const value={...(original||{}),...payload,id,name:safeText(payload.name),searchName:safeText(payload.name).toLowerCase(),phone:safeText(payload.phone),phoneNorm:normalizePhone(payload.phone),updatedAt:now,createdAt:original?.createdAt||now};
  if(!value.name&&!value.phone)throw Error('Customer needs a name or phone number');
  await put('customers',value);return value;
}
export async function setVehicle(reg,customerId,confirmTransfer=false){
  const regNorm=normalizeVehicle(reg);if(!regNorm)return null;
  return transact(['vehicles','audit'],'readwrite',async tx=>{
    const store=tx.objectStore('vehicles');const current=await request(store.index('regNorm').get(regNorm));
    if(current&&current.customerId!==customerId&&!confirmTransfer)throw new Error('Vehicle belongs to a different customer. Confirm reassignment.');
    const value={...(current||{}),id:current?.id||uid(),reg:safeText(reg).toUpperCase(),regNorm,customerId,createdAt:current?.createdAt||new Date().toISOString()};
    await request(store.put(value));
    if(current?.customerId!==customerId&&current){await request(tx.objectStore('audit').put({id:uid(),action:'vehicle-transfer',detail:regNorm,createdAt:new Date().toISOString()}));}
    return value;
  });
}
const stockInt = (value,field) => {const number=Number(value);if(!Number.isSafeInteger(number)||number<0)throw Error(`${field} must be a nonnegative whole number`);return number;};
export async function addCatalogItem(input){
  const price=Number(input.pricePaise||0),rate=Number(input.taxBps||0),cost=Number(input.costPaise||0);
  if(!Number.isSafeInteger(price)||price<0)throw Error('Invalid selling price');
  if(!Number.isSafeInteger(cost)||cost<0)throw Error('Invalid purchase cost');
  if(!Number.isInteger(rate)||rate<0||rate>10000)throw Error('Invalid tax rate');
  const name=safeText(input.name);if(!name)throw Error('Enter an item name');
  return transact(['catalog','inventoryMovements','audit'],'readwrite',async tx=>{
    const store=tx.objectStore('catalog');
    const prev=input.id?await request(store.get(input.id)):null;
    if(input.id&&!prev)throw Error('Price item not found');
    const type=input.type==='tyre'?'tyre':'service';
    const stockEnabled=type==='tyre';
    const beginning=prev ? stockInt(prev.stockQty||0,'Stock') : stockInt(input.openingStockQty||0,'Opening stock');
    if(prev && prev.type==='tyre' && type!=='tyre' && beginning>0)throw Error('Adjust stock to zero before changing a tracked tyre into a service');
    const now=new Date().toISOString();
    const value={...(prev||{}),id:input.id||uid(),name,searchName:name.toLowerCase(),type,pricePaise:price,taxBps:rate,code:safeText(input.code??prev?.code),sku:safeText(input.sku??prev?.sku),brand:safeText(input.brand??prev?.brand),model:safeText(input.model??prev?.model),size:safeText(input.size??prev?.size),supplier:safeText(input.supplier??prev?.supplier),costPaise:cost,lowStockAt:stockInt(input.lowStockAt??prev?.lowStockAt??5,'Low-stock threshold'),stockQty:beginning,trackStock:stockEnabled,isActive:input.isActive!==false,updatedAt:now,createdAt:prev?.createdAt||now};
    await request(store.put(value));
    if(!prev&&stockEnabled&&beginning>0){await request(tx.objectStore('inventoryMovements').add({id:uid(),productId:value.id,productName:value.name,delta:beginning,balanceAfter:beginning,type:'opening',note:'Opening stock',createdAt:now}));}
    await request(tx.objectStore('audit').add({id:uid(),action:prev?'product-updated':'product-created',detail:value.name,createdAt:now}));
    return value;
  });
}
/** Stock adjustment is atomic, audited, and cannot create negative stock. */
export async function adjustStock(productId,delta,reason){
  if(!Number.isSafeInteger(delta)||delta===0)throw Error('Enter a nonzero whole-number adjustment');
  if(!safeText(reason))throw Error('Enter a reason for the adjustment');
  return transact(['catalog','inventoryMovements','audit'],'readwrite',async tx=>{
    const store=tx.objectStore('catalog');const p=await request(store.get(productId));
    if(!p||p.type!=='tyre')throw Error('Choose a tyre from Inventory');
    const next=(p.stockQty||0)+delta;if(!Number.isSafeInteger(next)||next<0)throw Error('Insufficient stock for this adjustment');
    p.stockQty=next;p.updatedAt=new Date().toISOString();await request(store.put(p));
    await request(tx.objectStore('inventoryMovements').add({id:uid(),productId,productName:p.name,delta,balanceAfter:next,type:'adjustment',note:safeText(reason),createdAt:p.updatedAt}));
    await request(tx.objectStore('audit').add({id:uid(),action:'stock-adjusted',detail:`${p.name}: ${delta} (${reason})`,createdAt:p.updatedAt}));
    return p;
  });
}
/** Stock-in purchase; purchase cost stored for history and valuation. */
export async function recordPurchase({productId,qty,costPaise,supplier='',reference=''}){
  qty=stockInt(qty,'Quantity');costPaise=Number(costPaise);
  if(qty===0)throw Error('Purchase quantity must be greater than zero');
  if(!Number.isSafeInteger(costPaise)||costPaise<0)throw Error('Invalid purchase cost');
  return transact(['catalog','purchases','inventoryMovements','audit'],'readwrite',async tx=>{
    const store=tx.objectStore('catalog');const p=await request(store.get(productId));
    if(!p||p.type!=='tyre')throw Error('Choose a tyre from Inventory');
    const next=(p.stockQty||0)+qty;if(!Number.isSafeInteger(next))throw Error('Stock exceeds safe quantity');
    const now=new Date().toISOString();const id=uid();p.stockQty=next;p.costPaise=costPaise;p.supplier=safeText(supplier)||p.supplier||'';p.updatedAt=now;
    await request(store.put(p));
    const purchase={id,productId,productName:p.name,qty,costPaise,supplier:safeText(supplier),reference:safeText(reference),createdAt:now};
    await request(tx.objectStore('purchases').add(purchase));
    await request(tx.objectStore('inventoryMovements').add({id:uid(),productId,productName:p.name,delta:qty,balanceAfter:next,type:'purchase',reference:id,note:purchase.supplier||'Stock purchase',createdAt:now}));
    await request(tx.objectStore('audit').add({id:uid(),action:'stock-purchased',detail:`${p.name}: +${qty}`,createdAt:now}));
    return purchase;
  });
}
export async function completeOrder(input){
  const settings=await getSetting();if(!settings)throw Error('Complete shop setup first');
  const calculated=calculateBill(input.items,input.orderDiscount,{registered:settings.gstRegistered,supplyMode:input.supplyMode||'intra'});
  const paid=Number(input.paidPaise||0);
  const receipts=input.draftReceipts||[];
  if(!Array.isArray(receipts)||receipts.some(p=>typeof p.id!=='string'||!Number.isSafeInteger(p.amountPaise)||p.amountPaise<=0))throw Error('Invalid draft payment.');
  const received=receipts.reduce((sum,p)=>sum+p.amountPaise,paid);
  if(!Number.isSafeInteger(paid)||paid<0||received>calculated.totals.grandPaise)throw Error('Payment cannot exceed the bill total');
  const customerId=input.customerId||uid();const vehicleId=uid();const orderId=uid();const paymentId=uid();const now=new Date().toISOString();const requestId=input.requestId||uid();
  const customerName=safeText(input.customerName), customerPhone=safeText(input.customerPhone);const vehicle=safeText(input.vehicle).toUpperCase();
  if(!input.customerId&&!customerName&&!customerPhone)throw Error('Enter a customer name or number');
  if(!calculated.lines.every(l=>safeText(l.name)))throw Error('Every line needs a description');
  const serviceKey=name=>safeText(name).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
  const customServices=calculated.lines.filter(l=>!l.catalogId&&(!l.type||l.type==='service'));
  const serviceIds=new Map();
  for(const line of customServices){
    const key=serviceKey(line.name);
    if(!serviceIds.has(key))serviceIds.set(key,'service-'+await digest(key));
  }
  return transact(['settings','customers','vehicles','orders','payments','meta','audit','catalog','inventoryMovements'],'readwrite',async tx=>{
    const orders=tx.objectStore('orders');
    const existing=await request(orders.index('requestId').get(requestId));if(existing)return existing;
    const custStore=tx.objectStore('customers');const vehStore=tx.objectStore('vehicles');
    let customer=input.customerId?await request(custStore.get(input.customerId)):null;
    if(input.customerId&&!customer)throw Error('Selected customer no longer exists');
    if(!customer){customer={id:customerId,name:customerName,searchName:customerName.toLowerCase(),phone:customerPhone,phoneNorm:normalizePhone(customerPhone),createdAt:now,updatedAt:now};await request(custStore.put(customer));}
    if(vehicle){const existingVehicle=await request(vehStore.index('regNorm').get(normalizeVehicle(vehicle)));
      if(existingVehicle&&existingVehicle.customerId!==customer.id&&!input.confirmVehicleTransfer)throw Error('Vehicle belongs to another customer. Confirm reassignment to proceed.');
      const v={...(existingVehicle||{}),id:existingVehicle?.id||vehicleId,reg:vehicle,regNorm:normalizeVehicle(vehicle),customerId:customer.id,createdAt:existingVehicle?.createdAt||now};
      await request(vehStore.put(v));
      if(existingVehicle&&existingVehicle.customerId!==customer.id)await request(tx.objectStore('audit').put({id:uid(),action:'vehicle-transfer',detail:vehicle,createdAt:now}));
    }
    // Verify all tracked stock within the same transaction as invoice creation.
    // Aggregation prevents selling the same tyre twice through separate bill lines.
    const counts=new Map();
    for(const line of calculated.lines){
      if(!line.catalogId)continue;
      if(typeof line.catalogId!=='string')throw Error('Invalid product reference');
      const entry=counts.get(line.catalogId)||0;counts.set(line.catalogId,entry+line.qty);
    }
    const stockLines=[];const catalogStore=tx.objectStore('catalog');
    if(customServices.length){
      const services=await request(catalogStore.index('type').getAll('service'));
      const byName=new Map(services.filter(s=>s.isActive!==false).map(s=>[serviceKey(s.name),s]));
      for(const line of customServices){
        const key=serviceKey(line.name);
        let service=byName.get(key);
        if(!service){
          service={id:serviceIds.get(key),type:'service',name:safeText(line.name),searchName:safeText(line.name).toLowerCase(),
            code:safeText(line.code),pricePaise:line.unitPaise,taxBps:line.taxBps,isActive:true,trackStock:false,
            stockQty:0,costPaise:0,createdAt:now,updatedAt:now};
          await request(catalogStore.put(service));byName.set(key,service);
        }
        line.catalogId=service.id;
      }
    }
    for(const [productId,qty] of counts){
      const p=await request(catalogStore.get(productId));
      if(!p)throw Error('A selected price-list item was removed. Reopen the invoice.');
      if(p.type!=='tyre')continue;
      if((p.stockQty||0)<qty)throw Error(`Insufficient stock for ${p.name}: ${p.stockQty||0} available, ${qty} requested`);
      p.stockQty-=qty;p.updatedAt=now;await request(catalogStore.put(p));
      stockLines.push({productId,qty,unitCostPaise:p.costPaise||0,productName:p.name,balanceAfter:p.stockQty});
    }
    for(const l of calculated.lines){const st=stockLines.find(x=>x.productId===l.catalogId);if(st)l.unitCostPaise=st.unitCostPaise;}
    const meta=tx.objectStore('meta');const yy=new Date().getFullYear();const seqId=`invoice-${yy}`;const seq=(await request(meta.get(seqId)))?.value||0;const newSeq=seq+1;
    await request(meta.put({id:seqId,value:newSeq}));
    const invoicePrefix=safeText(settings.invoicePrefix||'INV').replace(/\s/g,'').toUpperCase().slice(0,12)||'INV';
    const device=await request(tx.objectStore('cloudState').get('device'));
    const number=device?.series?`${invoicePrefix.slice(0,3)}/${String(yy).slice(-2)}${device.series.toString(36).toUpperCase()}/${String(newSeq).padStart(5,'0')}`:`${invoicePrefix}-${yy}-${String(newSeq).padStart(5,'0')}`;
    const order={id:orderId,requestId,number,createdAt:now,date:todayISO(),customerId:customer.id,customerSnapshot:{name:customer.name,phone:customer.phone},vehicle,items:calculated.lines,totals:calculated.totals,orderDiscount:input.orderDiscount||{type:'fixed',value:0},supplyMode:input.supplyMode||'intra',paymentMethod:input.paymentMethod||'cash',paymentReference:safeText(input.paymentReference),notes:safeText(input.notes),status:'completed',shopSnapshot:{name:settings.name,owner:settings.owner,phone:settings.phone,whatsapp:settings.whatsapp,address:settings.address,city:settings.city,state:settings.state,gstin:settings.gstin,invoicePrefix,logoData:settings.logoData||'',gstRegistered:settings.gstRegistered,terms:settings.terms||'',language:settings.language||'en'}};
    await request(orders.add(order));
    for(const stock of stockLines){await request(tx.objectStore('inventoryMovements').add({id:uid(),productId:stock.productId,productName:stock.productName,delta:-stock.qty,balanceAfter:stock.balanceAfter,type:'sale',reference:orderId,note:number,createdAt:now}));}
    for(const p of receipts)await request(tx.objectStore('payments').add({id:p.id,orderId,amountPaise:p.amountPaise,method:'upi',reference:safeText(p.reference),createdAt:p.createdAt,type:'received'}));
    await request(tx.objectStore('cloudState').delete('draft-'+requestId));
    if(paid)await request(tx.objectStore('payments').add({id:paymentId,orderId,amountPaise:paid,method:input.paymentMethod||'cash',reference:safeText(input.paymentReference),createdAt:now,type:'received'}));
    await request(tx.objectStore('audit').put({id:uid(),action:'order-created',detail:number,createdAt:now}));
    return order;
  });
}
export async function addPayment(orderId,amountPaise,method='cash',reference='',confirmationId=''){
  amountPaise=Number(amountPaise);if(!Number.isSafeInteger(amountPaise)||amountPaise<=0)throw Error('Enter a valid payment');
  return transact(['orders','payments','audit'],'readwrite',async tx=>{
    if(confirmationId){const existing=await request(tx.objectStore('payments').get('confirmation-'+confirmationId));if(existing){if(existing.orderId!==orderId||existing.amountPaise!==amountPaise)throw Error('Payment confirmation already used.');return existing;}}
    const order=await request(tx.objectStore('orders').get(orderId));if(!order||order.status==='cancelled')throw Error('Invoice not found or cancelled');
    const payments=await request(tx.objectStore('payments').index('orderId').getAll(orderId));const due=calculateDue(order,payments).duePaise;
    const ref=safeText(reference).toLowerCase();
    if(ref&&payments.some(p=>p.type==='received'&&p.method===method&&String(p.reference||'').toLowerCase()===ref))throw Error('This transaction reference has already been recorded for this invoice.');
    if(amountPaise>due)throw Error('Payment exceeds remaining balance');
    const pay={id:confirmationId?'confirmation-'+confirmationId:uid(),orderId,amountPaise,method,reference:safeText(reference),type:'received',createdAt:new Date().toISOString()};
    await request(tx.objectStore('payments').add(pay));
    await request(tx.objectStore('audit').add({id:uid(),action:'payment-added',detail:`${order.number} / ${amountPaise}`,createdAt:pay.createdAt}));
    return pay;
  });
}
export async function recordRefund(orderId,amountPaise,method='cash',reference=''){
 amountPaise=Number(amountPaise);
 if(!Number.isSafeInteger(amountPaise)||amountPaise<=0)throw Error('Refund must be a positive amount');
 return transact(['orders','payments','audit'],'readwrite',async tx=>{
  const order=await request(tx.objectStore('orders').get(orderId));
  if(!order||order.status==='cancelled')throw Error('Invoice not found or cancelled');
  const ps=await request(tx.objectStore('payments').index('orderId').getAll(orderId));
  const paid=calculateDue(order,ps).paidPaise;
  if(amountPaise>paid)throw Error('Cannot refund more than the net amount previously received');
  const value={id:uid(),orderId,amountPaise:-amountPaise,method,reference:safeText(reference),type:'refund',createdAt:new Date().toISOString()};
  await request(tx.objectStore('payments').add(value));
  await request(tx.objectStore('audit').add({id:uid(),action:'refund-recorded',detail:`${order.number}: ${amountPaise} paise`,createdAt:value.createdAt}));
  return value;
 });
}
export async function cancelOrder(id,reason='') {
  return transact(['orders','payments','audit','catalog','inventoryMovements'],'readwrite',async tx=>{
    const order=await request(tx.objectStore('orders').get(id));if(!order||order.status==='cancelled')throw Error('Invoice not found or already cancelled');
    const payments=await request(tx.objectStore('payments').index('orderId').getAll(id));const balance=calculateDue(order,payments).paidPaise;
    if(balance>0)throw Error('Record a refund before cancelling a paid invoice. Contact support for refund processing.');
    // Restore tracked stock only once, on an actual cancellation.
    const counts=new Map();for(const line of order.items||[]){if(line.catalogId&&Number.isSafeInteger(line.unitCostPaise))counts.set(line.catalogId,(counts.get(line.catalogId)||0)+line.qty);}
    for(const [productId,qty] of counts){const store=tx.objectStore('catalog');const product=await request(store.get(productId));if(product?.type!=='tyre')continue;product.stockQty+=qty;product.updatedAt=new Date().toISOString();await request(store.put(product));await request(tx.objectStore('inventoryMovements').add({id:uid(),productId,productName:product.name,delta:qty,balanceAfter:product.stockQty,type:'cancellation',reference:id,note:order.number,createdAt:product.updatedAt}));}
    order.status='cancelled';order.cancelReason=safeText(reason);order.cancelledAt=new Date().toISOString();
    await request(tx.objectStore('orders').put(order));
    await request(tx.objectStore('audit').add({id:uid(),action:'order-cancelled',detail:`${order.number}: ${reason}`,createdAt:order.cancelledAt}));
    return order;
  });
}
export async function addExpense(input){
  const value={id:input.id||uid(),date:input.date||todayISO(),category:safeText(input.category)||'Other',description:safeText(input.description),amountPaise:Number(input.amountPaise),method:input.method||'cash',createdAt:input.createdAt||new Date().toISOString()};
  if(!Number.isSafeInteger(value.amountPaise)||value.amountPaise<=0)throw Error('Expense must be greater than zero');
  await put('expenses',value);return value;
}
// Only pending reminders are retained. Completion deletes the record permanently.
export async function saveReminder(input){
  const title=String(input.title||'').trim();
  const notes=String(input.notes||'').trim();
  const dueAt=String(input.dueAt||'');
  if(!title||title.length>160)throw Error('Enter a reminder title (maximum 160 characters).');
  if(notes.length>1000)throw Error('Reminder notes must be under 1,000 characters.');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(dueAt)||!Number.isFinite(Date.parse(dueAt)))throw Error('Choose a valid reminder date and time.');
  const existing=input.id?await get('reminders',input.id):null;
  if(input.id&&!existing)throw Error('This reminder has already been completed.');
  const reminder={id:existing?.id||uid(),title,notes,dueAt,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  await put('reminders',reminder);
  return reminder;
}
export async function completeReminder(id){
  const item=await get('reminders',id);
  if(!item)throw Error('This reminder is no longer available.');
  await transact(['reminders','cloudBase'],'readwrite',async tx=>{
    await request(tx.objectStore('reminders').delete(id));
    const base=tx.objectStore('cloudBase'),key=JSON.stringify(['reminders',id]);
    if(await request(base.get(key)))await request(base.put({id:key,doc:{id}}));
  });
  return item;
}
export async function summaryData(){
  const [settings,customers,vehicles,catalog,orders,payments,expenses,audit,inventoryMovements,purchases,reminders]=await Promise.all([getSetting(),all('customers'),all('vehicles'),all('catalog'),all('orders'),all('payments'),all('expenses'),all('audit'),all('inventoryMovements'),all('purchases'),all('reminders')]);
  const paymentsByOrder=new Map();for(const p of payments){if(!paymentsByOrder.has(p.orderId))paymentsByOrder.set(p.orderId,[]);paymentsByOrder.get(p.orderId).push(p);}
  const enriched=orders.map(o=>({...o,...calculateDue(o,paymentsByOrder.get(o.id)||[])}));
  return {settings,customers,vehicles,catalog,orders:enriched,payments,expenses,audit,inventoryMovements,purchases,reminders};
}
const canonical = v => JSON.stringify(v);
const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function exportBackup(){
  const payload={schemaVersion:DB_VERSION,app:'TyreDesk',exportedAt:new Date().toISOString(),data:{}};
  for(const store of STORES)payload.data[store]=await all(store);
  const checksum=await digest(canonical(payload));
  return JSON.stringify({payload,checksum},null,2);
}
export async function restoreBackup(json,{disconnectCloud=false}={}){
  if(json.length>100_000_000)throw Error('Backup file too large');
  let wrapper;try{wrapper=JSON.parse(json);}catch{throw Error('Invalid JSON backup');}
  if(!wrapper||!wrapper.payload||typeof wrapper.checksum!=='string')throw Error('Invalid backup structure');
  if(await digest(canonical(wrapper.payload))!==wrapper.checksum)throw Error('Backup checksum failed. The file is damaged or modified.');
  if(wrapper.payload.app!=='TyreDesk'||![3,4,5,6].includes(wrapper.payload.schemaVersion))throw Error('Incompatible backup version');
  const data={...wrapper.payload.data};
  // Legacy v3 backups predate inventory. Restoring them preserves their original records.
  if(wrapper.payload.schemaVersion===3){data.inventoryMovements=[];data.purchases=[];}
  if(wrapper.payload.schemaVersion<6)data.reminders=[];
  // Treat restored tyre records like current records even when the backup is old.
  if(Array.isArray(data.catalog))data.catalog=data.catalog.map(item=>item.type==='tyre'
    ? {...item,trackStock:true,stockQty:Number.isSafeInteger(item.stockQty)&&item.stockQty>=0?item.stockQty:0}
    : {...item,trackStock:false});
  for(const store of STORES){if(!Array.isArray(data?.[store])||data[store].some(record=>!record||typeof record.id!=='string'))throw Error(`Invalid backup table: ${store}`);}
  if(data.settings.length!==1||data.settings[0].id!=='shop')throw Error('Missing shop settings');
  // Single IndexedDB transaction. A failed restore rolls back all table changes.
  return transact([...STORES,'cloudState','cloudBase'],'readwrite',async tx=>{
    if(await request(tx.objectStore('cloudState').get('device'))&&!disconnectCloud)throw Error('Confirm restoring this device as an offline copy first.');
    await request(tx.objectStore('cloudState').clear());
    await request(tx.objectStore('cloudBase').clear());
    for(const store of STORES)await request(tx.objectStore(store).clear());
    for(const store of STORES)for(const value of data[store])await request(tx.objectStore(store).put(value));
    return Object.fromEntries(STORES.map(store=>[store,data[store].length]));
  });
}

export async function saveReceivedDraft(bill){
  return transact(['cloudState','orders'],'readwrite',async tx=>{
    if(await request(tx.objectStore('orders').index('requestId').get(bill.requestId)))throw Error('This draft already has an invoice.');
    await request(tx.objectStore('cloudState').put({id:'draft-'+bill.requestId,bill:{...bill,saving:false}}));
  });
}
export async function receivedDraft(){
  return transact(['cloudState'],'readonly',async tx=>{
    const rows=await request(tx.objectStore('cloudState').getAll(IDBKeyRange.bound('draft-','draft-\uffff'),1));
    return rows[0]?.bill;
  });
}
