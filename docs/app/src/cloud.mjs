import {GoTrueClient} from '../vendor/auth.mjs';
import {bindCloud,localCloud,snapshot,applyCloud,pendingWrite,stageWrite,clearWrite} from './cloud-store.mjs';
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
const notify=()=>window.dispatchEvent(new Event('tyredesk-cloud-status'));
function status(value){message=value;notify();}
export const cloudStatus=()=>({message,blocked,databaseBytes,dashboard:'https://supabase.com/dashboard/project/'+selected().ref});
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
  const res=await fetch('https://'+ref+'.supabase.co/rest/v1/rpc/tyredesk_'+action,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
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
    await finishFirstSetup({...draft.doc,...device.pin});
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
export async function finishFirstSetup(profile){
  const device=await localCloud();
  if(!device)throw Error('Sign in before setting up the shop.');
  await bindCloud(device.project,device.user,device.series,{pinHash:profile.pinHash,pinSalt:profile.pinSalt});
  const doc=cloudRecord('settings',{...profile,updatedAt:new Date().toISOString()});
  await put('cloudState',{id:'setupDraft',doc});
  const current=await accountProfile();
  if(!current.exists){
    const revision=await rpc('commit',{expected_revision:current.revision,
      changes:[{kind:'settings',key:'shop',doc}],device_token:localStorage.getItem('tyredesk-device-uuid'),write_token:crypto.randomUUID()});
    if(revision<0&&!(await accountProfile()).exists)throw Error('The account changed during setup. Please try again.');
  }
  await restoreAccount();
}
export async function logoutCloud(){
  if(running)await running;
  const {error}=await setupClient().signOut({scope:'local'});if(error)throw error;
  status('Signed out on this device. Local records are available with the shop PIN.');
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
  if(!navigator.onLine){status('Connection unavailable. Saved changes will sync when you reconnect.');return;}
  for(let attempt=0;attempt<5;attempt++){
    const token=localStorage.getItem('tyredesk-device-uuid');
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
        const rev=await rpc('commit',{expected_revision:pending.expected,changes:pending.outgoing,device_token:token,write_token:pending.token});
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
      const pending=await stageWrite(snap,merged,head.revision,outgoing);
      if(!pending)continue;
      try{
        revision=await rpc('commit',{expected_revision:head.revision,changes:outgoing,device_token:token,write_token:pending.token});
      }catch(e){if(e instanceof SyncConflict)await clearWrite();throw e;}
      if(revision<0){await clearWrite();continue;}
    }
    if(revision<0||!await applyCloud(snap,merged,revision))continue;
    if(changes(snap.local,merged).length)window.dispatchEvent(new Event('tyredesk-cloud-data'));
    blocked=false;status('Shop records synced.');return;
  }
  status('Changes are still arriving. TyreDesk will retry.');
}
export function syncCloud(useCloud=false){
  if(running)return useCloud?running.then(()=>syncCloud(true)):running;
  const run=()=>cycle(useCloud);
  running=(navigator.locks?navigator.locks.request("tyredesk-sync",run):run()).catch(e=>{blocked=e instanceof SyncConflict;status(e instanceof TypeError||e.name==='TimeoutError'?'Could not reach Supabase. Local changes are saved. Check your connection or project dashboard.':e.message);}).finally(()=>{running=null;});
  return running;
}
export function startCloud(){
  if(timer)return;
  const sync=()=>{if(!document.hidden)void syncCloud();};
  window.addEventListener('online',sync);window.addEventListener('offline',sync);document.addEventListener('visibilitychange',sync);
  timer=setInterval(sync,20000);sync();
}

export async function restoreOffline(restore){
 const run=async()=>{
   const result=await restore();
   if(client){await client.dispose();client=null;}
   const ref=selected().ref;localStorage.removeItem('tyredesk-session-'+ref);
   localStorage.removeItem('tyredesk-device-uuid');localStorage.removeItem(preference);
   blocked=false;status('Restored offline. Sign in to reconnect to the shop cloud.');return result;
 };
 if(running)await running;
 return navigator.locks?navigator.locks.request('tyredesk-sync',run):run();
}
