import {calculateBill,calculateDue,uid} from './logic.mjs';

// Compare the same tracked quantities before and after an invoice change.
export function trackedQuantities(items) {
  const result=new Map();
  for(const line of items){
    if(!line.catalogId||!Number.isSafeInteger(line.unitCostPaise))continue;
    result.set(line.catalogId,(result.get(line.catalogId)||0)+line.qty);
  }
  return result;
}

export async function prepareInvoiceEdit({tx,request,orderId,editToken,expectedEdit,items,discount,supplyMode,notes}) {
  const orders=tx.objectStore('orders');
  const prior=await request(orders.get(orderId));
  if(!prior||prior.status==='cancelled')throw Error('This invoice can no longer be edited.');
  if(prior.editToken===editToken)return prior;
  if((prior.editToken||'')!==expectedEdit)throw Error('This invoice changed. Open it again before editing.');
  const calculated=calculateBill(items,discount,{registered:prior.shopSnapshot?.gstRegistered,supplyMode});
  const payments=await request(tx.objectStore('payments').index('orderId').getAll(orderId));
  if(calculateDue(prior,payments).paidPaise>calculated.totals.grandPaise)
    throw Error('The corrected total is below the amount received. Record a refund first.');
  if(calculated.lines.some(l=>!String(l.name||'').trim()))throw Error('Every line needs a description.');
  const catalog=tx.objectStore('catalog');
  const before=trackedQuantities(prior.items);
  const products=new Map();
  for(const line of calculated.lines){
    if(!line.catalogId)continue;
    const product=await request(catalog.get(line.catalogId));
    if(!product)throw Error('A price-list item was removed.');
    if(product.type!=='tyre')continue;
    products.set(product.id,product);
    const previousLine=prior.items.find(l=>l.catalogId===product.id&&Number.isSafeInteger(l.unitCostPaise));
    line.unitCostPaise=previousLine?.unitCostPaise??product.costPaise??0;
  }
  const after=trackedQuantities(calculated.lines);
  const timestamp=new Date().toISOString();
  for(const id of new Set([...before.keys(),...after.keys()])){
    const delta=(before.get(id)||0)-(after.get(id)||0);
    if(!delta)continue;
    const product=products.get(id)||await request(catalog.get(id));
    if(!product||product.type!=='tyre')throw Error('The original tyre stock entry could not be found.');
    const balanceAfter=product.stockQty+delta;
    if(!Number.isSafeInteger(balanceAfter)||balanceAfter<0)throw Error('Insufficient stock for '+product.name);
    await request(catalog.put({...product,stockQty:balanceAfter,updatedAt:timestamp}));
    await request(tx.objectStore('inventoryMovements').add({id:uid(),productId:id,productName:product.name,
      delta,balanceAfter,type:'invoice-edit',reference:orderId,note:prior.number,createdAt:timestamp}));
  }
  const previous={items:prior.items,totals:prior.totals,orderDiscount:prior.orderDiscount,
    supplyMode:prior.supplyMode,notes:prior.notes,recordedAt:prior.editedAt||prior.createdAt};
  const next={...prior,items:calculated.lines,totals:calculated.totals,orderDiscount:discount,supplyMode,notes,
    editToken,editedAt:timestamp,previousVersions:[...(prior.previousVersions||[]),previous]};
  await request(orders.put(next));
  return next;
}

