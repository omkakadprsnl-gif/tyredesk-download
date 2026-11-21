export const SYNC_STORES=['settings','customers','vehicles','catalog','orders','payments','expenses','inventoryMovements','purchases','reminders','meta'];
export const rowKey=(kind,id)=>JSON.stringify([kind,id]);
export const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const same=(a,b)=>a===b||canonical(a)===canonical(b);
export function cloudRecord(kind,record){
  if(kind==='meta'&&!/^supplier-(invoice|pdf)-/.test(record.id))return null;
  if(kind==='settings'){
    const {pinHash,pinSalt,...rest}=record;
    return rest;
  }
  return record;
}
export function changes(before,after){
  const result=[];
  for(const key of new Set([...before.keys(),...after.keys()])){
    if(same(before.get(key),after.get(key)))continue;
    const [kind,id]=JSON.parse(key);
    result.push({kind,key:id,doc:after.get(key)??null});
  }
  return result;
}
export class SyncConflict extends Error {}
function conflict(message){throw new SyncConflict(message);}
export function reconcile(base,local,remote){
  const result=new Map(remote);
  const localMovements=new Map(), remoteProducts=new Set();
  const remotePayments=new Set();
  for(const [k,v] of remote){
    if(base.has(k))continue;
    const [kind]=JSON.parse(k);
    if(kind==='inventoryMovements')remoteProducts.add(v.productId);
    if(kind==='payments')remotePayments.add(v.orderId);
  }
  for(const [k,v] of local){
    if(base.has(k)||remote.has(k))continue;
    const [kind]=JSON.parse(k);
    if(kind==='inventoryMovements'){
      const list=localMovements.get(v.productId)||[];list.push(v);localMovements.set(v.productId,list);
    }
    if(kind==='payments'&&remotePayments.has(v.orderId)&&!v.reference)
      conflict('Two devices recorded payments against the same balance. Check the bank and invoice before reconciling the local copy.');
  }
  for(const {kind,key:id,doc:l} of changes(base,local)){
    const k=rowKey(kind,id), b=base.get(k), r=remote.get(k);
    if(kind==='reminders'&&b&&(!r||!l)){result.delete(k);continue;}
    if(!l)conflict('A restored backup would remove shared records. Keep a separate local copy for review.');
    if(!b&&r&&kind==='payments'&&l.id.startsWith('confirmation-')&&l.orderId===r.orderId&&l.amountPaise===r.amountPaise&&l.method===r.method&&l.reference===r.reference)continue;
    if(!b&&r&&!same(l,r))conflict('Two different '+kind+' records have the same identifier. Review both copies.');
    if(!r&&b)conflict('The shared '+kind+' record was removed while this device was offline.');
    if(!b||!r){result.set(k,l);continue;}
    const merged={...r};
    for(const field of new Set([...Object.keys(b),...Object.keys(l)])){
      if(kind==='catalog'&&field==='stockQty')continue;
      if(same(l[field],b[field]))continue;
      if(field==='updatedAt'){merged[field]=[l[field],r[field]].filter(Boolean).sort().at(-1);continue;}
      if(!same(r[field],b[field])&&!same(r[field],l[field]))conflict('Two devices changed '+field+' on the same '+kind+' record. Review the local and cloud copies.');
      if(l[field]===undefined)delete merged[field];else merged[field]=l[field];
    }
    if(kind==='catalog'){
      const moves=localMovements.get(id)||[];
      if(moves.length){
        let qty=Number(r.stockQty||0);
        for(const m of moves.slice().sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.balanceAfter-b.balanceAfter)){
          qty+=m.delta;
        }
        if(qty<0)conflict('Both devices sold the remaining stock of '+l.name+'. Review the sales and physical stock.');
        merged.stockQty=qty;
      }else if(l.stockQty!==b.stockQty&&!remoteProducts.has(id))merged.stockQty=l.stockQty;
    }
    result.set(k,merged);
  }
  for(const [id,moves] of localMovements){
    if(!remoteProducts.has(id))continue;
    const existing=[...remote.values()].filter(x=>x.productId===id&&x.type==='cancellation');
    let qty=remote.get(rowKey('catalog',id))?.stockQty??0;
    for(const m of moves.slice().sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.balanceAfter-b.balanceAfter)){
      if(m.type==='cancellation'&&existing.some(x=>x.reference===m.reference))conflict('Two devices cancelled the same sale. Review the stock return.');
      qty+=m.delta;result.set(rowKey('inventoryMovements',m.id),{...m,balanceAfter:qty});
    }
  }
  return result;
}
