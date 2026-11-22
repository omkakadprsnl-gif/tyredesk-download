import {transact,receivedDraft} from './db.mjs';
import {SYNC_STORES,rowKey,cloudRecord,changes} from './cloud-merge.mjs';
const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export const localCloud=()=>transact(['cloudState'],'readonly',tx=>req(tx.objectStore('cloudState').get('device')));
export async function setBillingState(billing,{requireSavedDraft=false}={}){
  return transact(['cloudState'],'readwrite',async tx=>{
    const state=tx.objectStore('cloudState');
    const device=await req(state.get('device'));
    if(!device)throw Error('Sign in to the shop before starting billing.');
    if(requireSavedDraft&&await receivedDraft(tx))
      throw Error('Save the invoice with the confirmed payment before switching devices.');
    await req(state.put({...device,billing}));
  });
}
export async function bindCloud(project,user,series,pin){
  return transact(['cloudState'],'readwrite',async tx=>{
    const s=tx.objectStore('cloudState'),old=await req(s.get('device'));
    if(old&&(old.project!==project||old.user!==user))throw Error('This device is already linked to another shop.');
    await req(s.put({...old,id:'device',project,user,series,generation:old?.generation||0,revision:old?.revision??-1,pin:old?.pin||pin}));
  });
}
async function readRecords(tx){
  const records=new Map();
  for(const kind of SYNC_STORES)for(const raw of await req(tx.objectStore(kind).getAll())){
    const doc=cloudRecord(kind,raw);if(doc)records.set(rowKey(kind,raw.id),doc);
  }
  return records;
}
export async function snapshot(){
  return transact([...SYNC_STORES,'cloudState','cloudBase'],'readonly',async tx=>{
    const device=await req(tx.objectStore('cloudState').get('device'));
    const base=new Map((await req(tx.objectStore('cloudBase').getAll())).map(r=>[r.id,r.doc]));
    return {device,base,local:await readRecords(tx)};
  });
}
export async function applyCloud(snap,target,revision,localTarget=target){
  return transact([...SYNC_STORES,'cloudState','cloudBase'],'readwrite',async tx=>{
    const state=tx.objectStore('cloudState'),device=await req(state.get('device'));
    if(device.revision!==snap.device.revision||device.generation!==snap.device.generation)return false;
    const shadow=tx.objectStore('cloudBase');
    for(const c of changes(snap.base,target)){
      const id=rowKey(c.kind,c.key);
      if(c.doc)await req(shadow.put({id,doc:c.doc}));else await req(shadow.delete(id));
    }
    for(const c of changes(snap.local,localTarget)){
      const s=tx.objectStore(c.kind);
      if(!c.doc){await req(s.delete(c.key));continue;}
      if(c.kind==='settings'){
        const current=await req(s.get('shop'));
        const {pinHash,pinSalt}=current||device.pin||{};
        if(!pinHash||!pinSalt)throw Error('Choose a local PIN on this device to recover the shop.');
        await req(s.put({...c.doc,pinHash,pinSalt}));
      }else await req(s.put(c.doc));
    }
    await req(state.put({...device,revision,cleanGeneration:localTarget===target?device.generation:-1,pin:target.has(rowKey("settings","shop"))?undefined:device.pin}));
    await req(state.delete('pending'));
    return true;
  });
}

export const pendingWrite=()=>transact(['cloudState'],'readonly',tx=>req(tx.objectStore('cloudState').get('pending')));
export async function stageWrite(snap,target,expected,outgoing){
  return transact(['cloudState'],'readwrite',async tx=>{
    const s=tx.objectStore('cloudState'),d=await req(s.get('device'));
    if(d.generation!==snap.device.generation||d.revision!==snap.device.revision)return null;
    const pending={id:'pending',token:crypto.randomUUID(),local:snap.local,target,expected,outgoing};
    await req(s.put(pending));return pending;
  });
}
export const clearWrite=()=>transact(['cloudState'],'readwrite',tx=>req(tx.objectStore('cloudState').delete('pending')));
