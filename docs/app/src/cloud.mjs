import {GoTrueClient} from '../vendor/auth.mjs';
import {bindCloud,localCloud,setBillingState,snapshot,applyCloud,pendingWrite,stageWrite,clearWrite} from './cloud-store.mjs';
import {get,getSetting,put,remove} from './db.mjs';
import {reconcile,changes,rowKey,cloudRecord,SyncConflict} from './cloud-merge.mjs';

// Set the shop-owned project here when provisioning a distribution.
const defaultProject={ref:'yaztgggiaraghfkcllzh',key:'sb_publishable_T6oFj9KLmXeejZO0RyTuqw_dPnHEnkD'};
const projectsByUsername={aai:defaultProject};
const preference='tyredesk-cloud-project';
const selected=()=>{
  try{return JSON.parse(localStorage.getItem(preference)||'null')||defaultProject;}
  catch{return defaultProject;}
};
let client=null, running=null, message='Sign in to sync this shop across devices.', blocked=false, timer, databaseBytes;
let billingAccess=null, billingBusy=false;
let canUseApp=()=>false, leavingPage=false, foregroundLock, leaveForeground, releasePending, maintenance=false;
let hadForeground=false, nativeForeground=true;
const notify=()=>window.dispatchEvent(new Event('tyredesk-cloud-status'));
function status(value){message=value;notify();}
export const cloudStatus=()=>({message,blocked,databaseBytes,billingAccess,billingBusy,dashboard:'https://supabase.com/dashboard/project/'+selected().ref});
function setupClient(){
  if(client)return client;
  const {ref,key}=selected();
  client=new GoTrueClient({url:'https://'+ref+'.supabase.co/auth/v1',headers:{apikey:key},storageKey:'tyredesk-session-'+ref,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false});
  return client;
}
async function rpc(action,body={}){
  const {data,error}=await setupClient().getSession();
  if(error)throw error;
  if(!data.session)throw Error('Sign in to resume cloud sync. This device keeps your local records.');
  const {key,ref}=selected();
  const device=await localCloud();
  if(device&&(device.project!==ref||device.user!==data.session.user.id))
    throw new SyncConflict('The signed-in account does not match this device’s shop.');
  const res=await fetch('https://'+ref+'.supabase.co/rest/v1/rpc/tyredesk_'+action,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000),keepalive:action==='billing_release'});
  if(!res.ok){
    const raw=await res.text();
    if(/project.{0,30}paused|project_paused/i.test(raw)||res.status===540)throw Error('Your Supabase project is paused. Open the project dashboard and choose Resume Project.');
    if(res.status>=500)throw Error('The cloud service is unavailable. Check the project dashboard. This device will retry.');
    let detail;try{detail=JSON.parse(raw).message;}catch{}
    if(/duplicate key|shared stock|inventory mode|invoice balance/i.test(detail||''))throw new SyncConflict('A shared invoice, payment or stock record conflicts with this device. Review both copies.');
    throw Error(detail||'The cloud request was declined ('+res.status+').');
  }
  return res.json();
}
export async function loginCloud({username,password,pin,onboarding=false}){
  if(!/^[a-z0-9._-]{1,60}$/i.test(username))throw Error('Enter your shop username.');
  const alias=username.toLowerCase();
  const login=async()=>{
    const existing=await localCloud();
    const backup=await get('cloudState','backupBinding');
    let target=selected();
    if(!existing){
      if(Object.hasOwn(projectsByUsername,alias))target=projectsByUsername[alias];
      else{
        const response=await fetch('https://omkakadprsnl-gif.github.io/tyredesk-download/shop-directory.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw Error('Shop sign-in is temporarily unavailable.');
        const directory=await response.json();
        if(!Object.hasOwn(directory,alias))throw Error('This shop username is not registered.');
        target=directory[alias];
      }
    }
    if(!/^[a-z0-9]{20}$/.test(target?.ref)||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(target?.key)||
       (existing&&existing.project!==target.ref))throw Error('This device’s shop connection needs support.');
    if(backup&&backup.project!==target.ref)throw Error('This backup belongs to a different shop.');
    if(client&&target.ref!==selected().ref){await client.dispose();client=null;}
    localStorage.setItem(preference,JSON.stringify(target));
    const auth=setupClient();
    const {data,error}=await auth.signInWithPassword({email:alias+'@shop.tyredesk.invalid',password});
    if(error)throw error;
    try{
      if(existing&&data.user.id!==existing.user)throw Error('This device is already linked to another shop.');
      if(backup&&data.user.id!==backup.user)throw Error('This backup belongs to a different shop.');
      await rpc('head');
      let token=localStorage.getItem('tyredesk-device-uuid');
      if(!token){token=crypto.randomUUID();localStorage.setItem('tyredesk-device-uuid',token);}
      const series=await rpc('device',{token});
      await bindCloud(target.ref,data.user.id,series,pin);
    }catch(err){await auth.signOut({scope:'local'});throw err;}
    blocked=false;
  };
  if(navigator.locks)await navigator.locks.request('tyredesk-sync',login);
  else {if(running)await running;await login();}
  if(!onboarding)await syncCloud();
}
// Read the owner-protected profile before offering setup. A failed read must
// never be interpreted as an empty shop.
async function accountProfile(){
  const head=await rpc('head');
  const page=await rpc('page',{since_revision:0,after_kind:'settings',after_key:''});
  return {revision:head.revision,exists:page.some(r=>r.kind==='settings'&&r.key==='shop')};
}
export async function firstRunStep(){
  const device=await localCloud();
  if(!device)return 'signin';
  const {data,error}=await setupClient().getSession();
  if(error)throw error;
  if(!data.session||data.session.user.id!==device.user)return 'signin';
  if(!(await accountProfile()).exists){
    const draft=await get('cloudState','setupDraft');
    if(!draft||!device.pin)return 'setup';
    await finishFirstSetup({...draft.doc,...device.pin},draft.services);
    return 'ready';
  }
  if(!device.pin)return 'pin';
  await restoreAccount();
  return 'ready';
}
export async function restoreAccount(pin){
  const device=await localCloud();
  if(!device)throw Error('Sign in to recover your shop.');
  if(pin)await bindCloud(device.project,device.user,device.series,pin);
  await syncCloud();
  if(!await getSetting())throw Error(cloudStatus().message);
  await remove('cloudState','setupDraft');
}
export async function finishFirstSetup(profile,services=[]){
  const device=await localCloud();
  if(!device)throw Error('Sign in before setting up the shop.');
  await bindCloud(device.project,device.user,device.series,{pinHash:profile.pinHash,pinSalt:profile.pinSalt});
  const doc=cloudRecord('settings',{...profile,updatedAt:new Date().toISOString()});
  await put('cloudState',{id:'setupDraft',doc,services});
  const current=await accountProfile();
  if(!current.exists){
    const records=[{kind:'settings',key:'shop',doc},...services.map(service=>({kind:'catalog',key:service.id,doc:service}))];
    try{
      const revision=await rpc('commit',{expected_revision:current.revision,
        changes:records,device_token:localStorage.getItem('tyredesk-device-uuid'),write_token:crypto.randomUUID()});
      if(revision<0&&!(await accountProfile()).exists)throw Error('The account changed during setup. Please try again.');
    }catch(error){if(!(await accountProfile()).exists)throw error;}
  }
  await restoreAccount();
}
export async function logoutCloud(){
  return duringMaintenance(async()=>{
    const device=await localCloud();
    if(await pendingWrite()||(device?.revision>=0&&device.generation!==device.cleanGeneration))
      throw Error('Sync this device’s saved changes before signing out.');
    const {error}=await setupClient().signOut({scope:'local'});if(error)throw error;
    billingAccess=device?'view':null;
    status('Signed out on this device. Local records are available with the shop PIN.');
  });
}
async function duringMaintenance(run){
  maintenance=true;
  try{
    if((await localCloud())?.billing)await finishBilling();
    return await withSyncLock(run);
  }finally{maintenance=false;updateCloudPresence();}
}
const deviceToken=()=>localStorage.getItem('tyredesk-device-uuid');
const withSyncLock=run=>navigator.locks?navigator.locks.request('tyredesk-sync',run):run();
const billingRpc=(action,billing,extra)=>rpc('billing_'+action,{device_token:deviceToken(),grant_token:billing?.token??null,...extra});
async function refreshBilling(online=false){
  const device=await localCloud();
  let access=device?.billing?.phase||(device?'view':null);
  if(!device&&await get('cloudState','backupBinding'))access='disconnected';
  if(online&&access==='view'){
    try{if(await billingRpc('status')==='busy')access='busy';}catch{}
  }
  if(access!==billingAccess){billingAccess=access;notify();}
}
async function billingAction(run){
  if(!navigator.locks)throw Error('Update your browser or Android System WebView to switch billing devices.');
  if(billingBusy)return;
  billingBusy=true;notify();
  try{return await withSyncLock(async()=>{
    if(!navigator.onLine)throw Error('Connect to the internet to switch billing devices.');
    return run();
  });}
  finally{
    billingBusy=false;
    await refreshBilling(navigator.onLine);
    notify();
  }
}
async function syncForBilling(){
  await cycle();
  const device=await localCloud();
  if(device.revision<0||device.generation!==device.cleanGeneration||await pendingWrite())
    throw Error('Billing cannot switch until all changes on this device have synced.');
  return device.revision;
}
export function startBilling(){
  return billingAction(async()=>{
    const device=await localCloud();
    if(!device)throw Error('Sign in to start billing.');
    if(device.billing?.phase==='active')return;
    if(device.billing?.phase==='switching')throw Error('Wait for the billing handover to finish.');
    const billing=device.billing||{phase:'claiming',token:crypto.randomUUID()};
    if(await billingRpc('status',billing)==='busy'){
      if(device.billing)await setBillingState(undefined);
      return;
    }
    if(!device.billing)await setBillingState(billing);
    let revision;
    try{revision=await syncForBilling();}
    catch(error){
      // A persisted claim may already have reached the server after a lost response.
      if(await billingRpc('status',billing)==='free')await setBillingState(undefined);
      throw error;
    }
    const result=await billingRpc('claim',billing,{expected_revision:revision});
    if(result==='own')await setBillingState({...billing,phase:'active'});
    else if(result==='busy'||result==='stale'){
      await setBillingState(undefined);
      if(result==='stale')throw Error('Shop records changed. Tap Start billing to load the latest copy.');
    }else throw Error('Could not confirm billing access. Tap Retry start billing.');
  });
}
async function releaseBilling(shouldRelease){
  return withSyncLock(async()=>{
    if(!navigator.onLine||!shouldRelease())return;
    const device=await localCloud();
    if(!device?.billing)return;
    if(device.billing.phase==='claiming'&&await billingRpc('status',device.billing)!=='own'){
      await setBillingState(undefined);
      return;
    }
    const billing={...device.billing,phase:'switching'};
    const frozen=await setBillingState(billing,{requireSavedDraft:true});
    await refreshBilling();
    const clean=frozen.revision>=0&&frozen.generation===frozen.cleanGeneration&&!await pendingWrite();
    let revision=clean?frozen.revision:await syncForBilling();
    let result=await billingRpc('release',billing,{expected_revision:revision});
    if(result==='stale'&&clean){
      revision=await syncForBilling();
      result=await billingRpc('release',billing,{expected_revision:revision});
    }
    if(result!=='released')throw Error('Billing is waiting for the handover to finish.');
    await setBillingState(undefined);
    await refreshBilling();
  });
}
export function finishBilling(){
  if(!navigator.onLine)throw Error('Connect to the internet to switch billing devices.');
  return releaseBilling(()=>true);
}
async function remoteView(base,revision,head){
  const full=revision<0||revision<head.lastDelete;
  const records=full?new Map():new Map(base);
  let kind='',key='';
  for(;;){
    const rows=await rpc('page',{since_revision:full?0:revision,after_kind:kind,after_key:key});
    for(const row of rows){kind=row.kind;key=row.key;records.set(rowKey(kind,key),row.doc);}
    if(rows.length<100)break;
  }
  if((await rpc('head')).revision!==head.revision)return null;
  return records;
}
async function cycle(useCloud=false){
  const d=await localCloud();if(!d)return;
  if(useCloud&&d.billing)throw Error('Finish and switch billing before replacing this device’s records.');
  if(!navigator.onLine){status('Connection unavailable. Saved changes will sync when you reconnect.');return;}
  for(let attempt=0;attempt<5;attempt++){
    const token=deviceToken();
    const pending=await pendingWrite();
    if(pending&&useCloud){await clearWrite();continue;}
    if(pending){
      const accepted=await rpc('receipt',{device_token:token,write_token:pending.token});
      if(accepted>=0){
        const now=await snapshot();
        const next=reconcile(pending.local,now.local,pending.target);
        if(await applyCloud(now,pending.target,accepted,next))window.dispatchEvent(new Event('tyredesk-cloud-data'));
        continue;
      }
      // An interrupted request may still reach the database. Reuse its token and
      // exact payload until the server definitively accepts or rejects the revision.
      const head=await rpc('head');
      if(head.revision===pending.expected){
        const rev=await commitBilling(d,pending);
        if(rev>=0)continue;
      }
      await clearWrite();
      continue;
    }
    const head=await rpc('head');
    databaseBytes=head.databaseBytes;
    const device=await localCloud();
    if(!useCloud&&device.revision===head.revision&&device.cleanGeneration===device.generation){
      status('Shop records synced.');return;
    }
    const snap=await snapshot();
    const remote=await remoteView(snap.base,snap.device.revision,head);
    if(!remote)continue;
    const k=rowKey('settings','shop'),l=snap.local.get(k),r=remote.get(k);
    const backup=await get('cloudState','backupBinding');
    if(!useCloud&&snap.device.revision<0&&l&&!r&&(!backup||backup.project!==snap.device.project||backup.user!==snap.device.user))
      throw new SyncConflict('This device has business records and the cloud shop is empty. Contact support to verify the recovery source.');
    if(!useCloud&&snap.device.revision<0&&l&&r&&l.createdAt!==r.createdAt)
      throw new SyncConflict('This device and the cloud contain different shop setups. Export this device before choosing the cloud shop.');
    if(!useCloud&&snap.device.revision<0&&l&&r&&changes(remote,snap.local).length)
      throw new SyncConflict('Cloud records and this previously unlinked device differ. Back up this device before recovering the current cloud copy.');
    const merged=useCloud?remote:reconcile(snap.base,snap.local,remote);
    const outgoing=changes(remote,merged);
    let revision=head.revision;
    if(outgoing.length){
      validateBillingGrant(snap.device);
      const pending=await stageWrite(snap,merged,head.revision,outgoing);
      if(!pending)continue;
      try{
        revision=await commitBilling(snap.device,pending);
      }catch(e){if(e instanceof SyncConflict)await clearWrite();throw e;}
      if(revision<0){await clearWrite();continue;}
    }
    if(revision<0||!await applyCloud(snap,merged,revision))continue;
    if(changes(snap.local,merged).length)window.dispatchEvent(new Event('tyredesk-cloud-data'));
    blocked=false;status('Shop records synced.');return;
  }
  status('Changes are still arriving. TyreDesk will retry.');
}
function validateBillingGrant(device){
  if(!['active','switching'].includes(device.billing?.phase))
    throw Error('This device has changes from before billing access was set up. Export a backup and contact support to reconcile them.');
}
function commitBilling(device,pending){
  validateBillingGrant(device);
  return billingRpc('commit',device.billing,{expected_revision:pending.expected,changes:pending.outgoing,write_token:pending.token});
}
export function syncCloud(useCloud=false){
  if(running)return useCloud?running.then(()=>syncCloud(true)):running;
  const run=async()=>{await refreshBilling(navigator.onLine);await cycle(useCloud);};
  running=withSyncLock(run).catch(e=>{blocked=e instanceof SyncConflict;status(e instanceof TypeError||e.name==='TimeoutError'?'Could not reach Supabase. Local changes are saved. Check your connection or project dashboard.':e.message);}).finally(()=>{running=null;});
  return running;
}
const usingApp=()=>canUseApp()&&!document.hidden&&nativeForeground&&!leavingPage&&!maintenance;
function releaseIfUnused(){
  if(!hadForeground||!navigator.locks||releasePending||!navigator.onLine)return;
  releasePending=navigator.locks.request('tyredesk-foreground',{ifAvailable:true},async lock=>{
    if(lock)await releaseBilling(()=>!usingApp());
  }).catch(e=>status(e.message)).finally(()=>{releasePending=null;});
}
async function manageForegroundBilling(){
  if(!navigator.locks||!navigator.onLine||billingBusy)return;
  const device=await localCloud();
  if(!usingApp()||!device||device.billing?.phase==='active')return;
  if(!(await setupClient().getSession()).data.session)return;
  if(device.billing?.phase==='switching')await finishBilling();
  if(usingApp())await startBilling();
}
export function updateCloudPresence(){
  if(!usingApp()){
    const previousLock=foregroundLock;
    leaveForeground?.();
    void Promise.resolve(previousLock).then(()=>{if(!usingApp())releaseIfUnused();});
    return;
  }
  if(navigator.locks&&!foregroundLock){
    foregroundLock=navigator.locks.request('tyredesk-foreground',{mode:'shared'},async()=>{
      if(!usingApp())return;
      hadForeground=true;
      try{
        await new Promise(resolve=>{
          leaveForeground=resolve;
          void manageForegroundBilling().catch(e=>status(e.message));
        });
      }finally{leaveForeground=null;}
    }).finally(()=>{foregroundLock=null;if(usingApp())updateCloudPresence();});
  }
}
export function startCloud(canUse=canUseApp){
  canUseApp=canUse;
  if(timer){updateCloudPresence();return;}
  const sync=()=>{if(usingApp())void syncCloud();};
  const online=()=>{updateCloudPresence();sync();};
  const pagehide=()=>{leavingPage=true;updateCloudPresence();};
  const pageshow=()=>{leavingPage=false;online();};
  window.addEventListener('online',online);window.addEventListener('offline',sync);
  window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);
  window.addEventListener('tyredesk-native-foreground',event=>{nativeForeground=event.detail===true;online();});
  document.addEventListener('visibilitychange',online);
  setInterval(()=>{
    if(usingApp()&&leaveForeground)void manageForegroundBilling().catch(e=>status(e.message));
  },3000);
  timer=setInterval(sync,20000);
  online();
}

export async function restoreOffline(restore){
 const run=async()=>{
   const result=await restore();
   if(client){await client.dispose();client=null;}
   const ref=selected().ref;localStorage.removeItem('tyredesk-session-'+ref);
   localStorage.removeItem('tyredesk-device-uuid');localStorage.removeItem(preference);
   blocked=false;await refreshBilling();status('Restored offline. Sign in to reconnect to the shop cloud.');return result;
 };
 return duringMaintenance(run);
}
