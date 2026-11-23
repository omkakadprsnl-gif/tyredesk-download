import {inventoryCategories,productCategory,isStockProduct,isVariantTyre,tyreSearchText,tyreFields,stockKeyFields} from './tyres.mjs';
import {initUpdates,checkUpdates,installAppUpdate,updateStatus} from './updates.mjs';
import {inventoryMode,tyreName,customTyreFields,defaultTyreFields} from './tyres.mjs';
import {mondayBackupDue} from './backup-reminder.mjs';
import {modeChoices,purchaseFields,updatePurchaseFields,tyrePicker,updateTyrePicker} from './tyre-ui.mjs';
import {loginCloud,firstRunStep,restoreAccount,finishFirstSetup,logoutCloud,cloudStatus,syncCloud,startCloud,restoreOffline,updateCloudPresence} from './cloud.mjs';
import {getDatabase,saveReceivedDraft,receivedDraft, getSetting,saveSetting,saveReminder,completeReminder,summaryData,invoiceDetails,customerDetails,upsertCustomer,setVehicle,addCatalogItem,adjustStock,buyTyres,recordPurchase,saveInventoryCategory,setInventoryMode,completeOrder,editOrder,addPayment,recordRefund,cancelOrder,addExpense,exportBackup,packAndroidBackup,restoreBackup,searchCustomers,all,addAudit} from './db.mjs';
import {uid,escapeHTML,toPaise,fromPaise,formatMoney,todayISO,monthISO,normalizePhone,normalizeVehicle,toCSV,fileSafeName,calculateBill,estimateProfit} from './logic.mjs';
import {t} from './i18n.mjs';
import {legalLinks,consentRecord,openLegalPage} from './legal.mjs';
import {invoiceInner,completeInvoiceHtml} from './invoice.mjs';
import {formatWhatsAppBill,whatsappBillUrl,whatsappRecipient,whatsappReminderUrl} from './whatsapp.mjs';
import {createPwaBackupManager} from './pwa-backup.mjs';
const $=selector=>document.querySelector(selector);
const E=escapeHTML;
const ICONS={
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/>',
 message:'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
 wheel:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6m0 6v6M3 12h6m6 0h6M5.6 5.6l4.2 4.2m4.4 4.4 4.2 4.2m0-12.8-4.2 4.2m-4.4 4.4-4.2 4.2"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 receipt:'<path d="M4 3h16v18l-4-2-4 2-4-2-4 2V3Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 tag:'<path d="M3 11V3h8l10 10-8 8L3 11Z"/><circle cx="7.5" cy="7.5" r="1"/>',
 wallet:'<rect x="2" y="5" width="20" height="15" rx="2"/><path d="M16 14h6M2 9h20M6 5V3h12"/>',
 chart:'<path d="M3 3v18h18M7 15l4-5 3 2 5-7"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.08.08-2.3 2.3-.09-.08a1.7 1.7 0 0 0-1.87-.34l-.1.04a1.7 1.7 0 0 0-1.04 1.56V21h-3.3v-.12a1.7 1.7 0 0 0-1.04-1.56l-.1-.04a1.7 1.7 0 0 0-1.87.34l-.08.08-2.3-2.3.08-.09a1.7 1.7 0 0 0 .34-1.87l-.04-.1A1.7 1.7 0 0 0 4.58 14.3H4v-3.3h.58a1.7 1.7 0 0 0 1.56-1.04l.04-.1a1.7 1.7 0 0 0-.34-1.87l-.08-.08 2.3-2.3.09.08a1.7 1.7 0 0 0 1.87.34l.1-.04a1.7 1.7 0 0 0 1.04-1.56V4h3.3v.58a1.7 1.7 0 0 0 1.04 1.56l.1.04a1.7 1.7 0 0 0 1.87-.34l.08-.08 2.3 2.3-.08.09a1.7 1.7 0 0 0-.34 1.87l.04.1A1.7 1.7 0 0 0 20.72 11H21v3.3h-.28a1.7 1.7 0 0 0-1.56 1.04z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',arrow:'<path d="M5 12h14m-7-7 7 7-7 7"/>', chevron:'<path d="m9 18 6-6-6-6"/>',down:'<path d="m6 9 6 6 6-6"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',close:'<path d="M5 5l14 14M19 5 5 19"/>',check:'<path d="m5 12 4 4L19 6"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',upload:'<path d="M12 21V9m-4 4 4-4 4 4M4 7V3h16v4"/>',printer:'<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',trash:'<path d="M3 6h18M8 6V4h8v2m-9 0 1 15h8l1-15M10 10v7m4-7v7"/>',edit:'<path d="m14 5 5 5M4 20l4.5-1 11-11a2 2 0 0 0-4-4l-11 11L4 20Z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',shield:'<path d="m12 2 9 4v6c0 6-4 9-9 10-5-1-9-4-9-10V6l9-4Z"/><path d="m8.5 12 2.5 2.5 5-5"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',alert:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3h.01"/>',info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v5m0-8h.01"/>',car:'<path d="M5 10 7 5h10l2 5M4 10h16a2 2 0 0 1 2 2v5H2v-5a2 2 0 0 1 2-2ZM5 17v3m14-3v3M5 13h2m10 0h2"/>',spark:'<path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3ZM20 18l.5 1.5L22 20l-1.5.5L20 22l-.5-1.5L18 20l1.5-.5L20 18Z"/>',file:'<path d="M13 3H5v18h14V9l-6-6Z"/><path d="M13 3v6h6M8 14h8M8 17h8"/>',credit:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',checkcircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',minus:'<path d="M5 12h14"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01"/>',filter:'<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',moon:'<path d="M20 16a8 8 0 0 1-12-12A8 8 0 1 0 20 16Z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',mobile:'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5M5 9a8 8 0 0 1 13-3l2 1M4 17l2 1a8 8 0 0 0 13-3"/>',bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',money:'<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 8h.01M19 16h.01"/>',dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
};
const I=(name,cl='')=>`<svg class="${cl}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||ICONS.info}</svg>`;
const state={page:'dashboard',data:null,locked:true,menuOpen:false,modal:null,search:'',salesStatus:'all',reportStart:monthISO()+'-01',reportEnd:todayISO(),bill:null,setupImage:null,setupLang:'en',installPrompt:null,restoring:false};
const lang=()=>state.data?.settings?.language||state.setupLang||'en';
const T=k=>t(k,lang());
const M=p=>formatMoney(p,lang());
const fmtDate=(date,short=false)=>new Date(date).toLocaleDateString(lang()==='hi'?'hi-IN':lang()==='mr'?'mr-IN':'en-IN',{day:'2-digit',month:short?'short':'long',year:short?undefined:'numeric'});
const safe=(v)=>E(String(v??''));
const now=()=>new Date().toISOString();
const numeric=(v)=>Number(v||0);
const activeOrders=()=>state.data.orders.filter(o=>o.status!=='cancelled');
const backupInfo={enabled:false,lastSaved:null,folder:'',error:'',needsPermission:false,driveLastSaved:null};
// Hosted HTTPS PWA uses the user's approved local folder, not the old Node.js backup endpoint.
const hostedPwa=()=>!nativeAndroid()&&window.location.protocol==='https:';
const pwaBackups=createPwaBackupManager();
const reminderStore=globalThis.localStorage||{getItem:()=>null,setItem:()=>{}};
const driveDay=()=>todayISO();
const driveReminderDismissKey='tyredesk-drive-reminder-dismissed';
const localDriveDateKey='tyredesk-drive-provider-saved';
const driveMarker=()=>nativeAndroid()?backupInfo.driveLastSaved:reminderStore.getItem(localDriveDateKey);
const driveReminderDue=()=>mondayBackupDue({now:new Date(),dateKey:driveDay(),
 lastSaved:driveMarker(),dismissedDate:reminderStore.getItem(driveReminderDismissKey),
 shopReady:!!state.data?.settings});
const backupFileName=()=>`TyreDesk-backup-${todayISO()}-${fileSafeName(state.data.settings.name)}.json`;
let backupTimer=null,backupBusy=false;
const nativeAndroid=()=>!!window.TyreDeskAndroid?.stageBackupSnapshot;
function backupStatusLine(){
 if(hostedPwa()&&!backupInfo.enabled){
  if(backupInfo.needsPermission)return 'Backup paused: reconnect the folder to allow automatic saving.';
  if(backupInfo.error)return 'Backup problem: '+backupInfo.error;
  return 'Not set up yet. Choose a backup folder once to enable automatic local backups.';
 }
 if(nativeAndroid()&&!backupInfo.enabled)return 'For this Android version, choose a local backup folder once.';
 if(backupInfo.error)return 'Backup problem: '+backupInfo.error;
 if(backupInfo.lastSaved)return 'Last verified local backup: '+new Date(backupInfo.lastSaved).toLocaleString('en-IN');
 return 'One automatic local backup per day while TyreDesk is open.';
}
function backupFolderActionLabel(){return backupInfo.needsPermission?'Reconnect Backup Folder':backupInfo.folder?'Change Backup Folder':'Choose Backup Folder';}
function backupSettingsCard(){return `<div class="autobackup-panel"><div class="autobackup-symbol">${I('database')}</div><div class="autobackup-copy"><strong>Daily automatic backups</strong><p data-backup-status>${E(backupStatusLine())}</p><small>${hostedPwa()?'Choose a folder in Chrome or Edge once. TyreDesk saves one verified recovery file per day while the app is open.':nativeAndroid()?'Automatic copies are saved once per day while TyreDesk is open, in Downloads / TyreDesk Backups (Android 10+) or your chosen folder.':'Automatic copies: Documents / TyreDesk Backups while the local PC app is running.'} Up to 14 daily restore points are kept. ${hostedPwa()?'Folder permission may need renewing after restarting the browser.':''}</small></div>${nativeAndroid()||hostedPwa()?`<button type="button" class="button" data-action="choose-backup-folder"><span data-backup-folder-label>${E(backupFolderActionLabel())}</span></button>`:''}</div>`;}
function updateBackupStatus(){
 document.querySelectorAll('[data-backup-status]').forEach(el=>{el.textContent=backupStatusLine();});
 document.querySelectorAll('[data-backup-folder-label]').forEach(el=>{el.textContent=backupFolderActionLabel();});
}
async function loadBackupStatus(){
 try {
  if(nativeAndroid()){const x=JSON.parse(window.TyreDeskAndroid.getBackupStatus());Object.assign(backupInfo,x);}
  else if(hostedPwa())Object.assign(backupInfo,await pwaBackups.getStatus());
  else {const r=await fetch('/_tyredesk/backup-status',{cache:'no-store'});if(r.ok)Object.assign(backupInfo,await r.json());}
 }catch(e){backupInfo.error=e.message;console.warn('Auto backup status not available',e)}
 updateBackupStatus();
}
function automaticBackupDue(){
 const saved=backupInfo.lastSaved?new Date(backupInfo.lastSaved):null;
 return document.visibilityState==='visible' && !!state.data?.settings &&
   (!saved||!Number.isFinite(saved.getTime())||todayISO(saved)!==todayISO());
}
async function flushAutoBackup(){
 backupTimer=null;
 if(backupBusy||!automaticBackupDue())return;
 backupBusy=true;
 const write=async()=>{
   await loadBackupStatus();
   if(!automaticBackupDue()||(hostedPwa()&&!backupInfo.enabled))return;
   const json=await exportBackup();
   if(document.visibilityState!=='visible')return;
   if(nativeAndroid()){
     const packed=await packAndroidBackup(json);
     if(document.visibilityState==='visible')window.TyreDeskAndroid.stageBackupSnapshot(packed);
   }else if(hostedPwa()){
     Object.assign(backupInfo,await pwaBackups.saveBackup(json));
   }else{
     const resp=await fetch('/_tyredesk/autobackup',{method:'POST',headers:{'Content-Type':'application/json','X-TyreDesk-Local':'backup-v1'},body:json,cache:'no-store'});
     if(!resp.ok)throw Error('PC backup unavailable ('+resp.status+')');
     Object.assign(backupInfo,await resp.json());
   }
   backupInfo.error='';
 };
 try{
   if(navigator.locks)await navigator.locks.request('tyredesk-daily-backup',write);
   else await write();
 }catch(err){backupInfo.error=err.message;console.warn('Automatic backup could not be saved:',err);}
 finally{backupBusy=false;updateBackupStatus();}
}
function scheduleAutoBackup(){
 if(backupBusy||backupTimer!==null||!automaticBackupDue())return;
 backupTimer=setTimeout(flushAutoBackup,1100);
}
window.TyreDeskBackupFolderReady=()=>{loadBackupStatus().then(()=>scheduleAutoBackup())};
window.TyreDeskBackupStatusChanged=()=>{loadBackupStatus()};
window.TyreDeskDriveBackupSaved=(saved)=>{if(saved){loadBackupStatus().then(()=>{toast('Backup saved through Google Drive. Check that it appears in your Drive account.');render();});}else{toast('Google Drive backup not confirmed. Select Google Drive in the file picker.',true);}};

function toast(message,error=false){const host=$('#toasts');if(!host)return;const el=document.createElement('div');el.className=`toast ${error?'error':''}`;el.innerHTML=I(error?'alert':'checkcircle')+`<span>${E(message)}</span>`;host.append(el);setTimeout(()=>el.remove(),4600);}
function errorMessage(err){console.error(err);toast(err?.message||String(err),true);}
const amountField=(value)=>E(fromPaise(value||0));
async function hashPin(pin,saltHex){const salt=new Uint8Array(saltHex.match(/../g).map(h=>parseInt(h,16)));const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:240000,hash:'SHA-256'},key,256);return Array.from(new Uint8Array(bits)).map(x=>x.toString(16).padStart(2,'0')).join('');}
function salt(){return Array.from(crypto.getRandomValues(new Uint8Array(16))).map(x=>x.toString(16).padStart(2,'0')).join('');}
const needsFullHistory=page=>!['dashboard','billing','sales','settings'].includes(page);
async function refresh(){const page=state.page;const data=await summaryData({dashboard:!needsFullHistory(page)});if(state.page!==page)return;state.data=data;document.body.dataset.theme=state.data.settings?.theme||'light';document.documentElement.lang=lang();render();scheduleAutoBackup();}
function startBill(){state.bill={customerQuery:'',selectedCustomerId:null,customerName:'',customerPhone:'',vehicle:'',lines:[],billDiscountType:'fixed',billDiscountValue:'0',paid:'0',method:'cash',paymentReference:'',notes:'',supplyMode:'intra',requestId:uid(),saving:false};}
async function init(){try{await getDatabase();const shop=await getSetting();state.bill=shop?await receivedDraft():null;state.locked=!!shop&&sessionStorage.getItem('tyredesk-unlocked')!=='yes';if(state.locked){state.data={settings:shop,dashboard:true};render();}else await refresh();await loadBackupStatus();render();if(!nativeAndroid()&&'serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service worker not available',err));}window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;});
 document.addEventListener('visibilitychange',scheduleAutoBackup);
 window.addEventListener('focus',scheduleAutoBackup);
 window.setInterval(scheduleAutoBackup,15*60*1000);
 scheduleAutoBackup();
 }catch(e){console.error(e);$('#app').innerHTML=`<div class="boot"><h1>Unable to open local data</h1><p>${E(e.message)}</p><p>Use localhost or HTTPS and check that browser storage is enabled.</p></div>`;}}
function pendingReminders(){return (state.data?.reminders||[]).slice().sort((a,b)=>a.dueAt.localeCompare(b.dueAt));}

function dueReminders(){return pendingReminders().filter(r=>Date.parse(r.dueAt)<=Date.now());}

function reminderDateLabel(value){const date=new Date(value);return date.toLocaleString(lang()==='hi'?'hi-IN':lang()==='mr'?'mr-IN':'en-IN',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'});}

function reminderRow(r){
 const due=Date.parse(r.dueAt)<=Date.now();
 return `<div class="reminder-row ${due?'is-due':''}">
   <div class="reminder-row-icon">${I('bell')}</div>
   <div class="reminder-row-info"><strong>${E(r.title)}</strong><span class="reminder-row-when">${I('clock')} ${E(reminderDateLabel(r.dueAt))}${due?` <b>· ${T('remindersDue')}</b>`:''}</span>${r.notes?`<p>${E(r.notes)}</p>`:''}</div>
   <div class="reminder-row-actions"><button class="button small" data-action="edit-reminder" data-reminder="${E(r.id)}">${T('remindersEdit')}</button><button class="button small reminder-complete" data-action="complete-reminder" data-reminder="${E(r.id)}">${I('check')} ${T('remindersDone')}</button></div>
 </div>`;
}

function homeTools(){
 const pending=pendingReminders();
 const due=dueReminders();
 const next=due[0]||pending[0];
 const backupDue=driveReminderDue()||((hostedPwa()||nativeAndroid())&&!backupInfo.enabled);
 return `<div class="dash-home-tools" aria-label="Reminders and backups">
   <button type="button" class="button" data-action="add-reminder">${I('bell')}${T('remindersAdd')}</button>
   <button type="button" class="button" data-action="backup-options">${I('download')}Backup${backupDue?'<span class="backup-attention-dot" aria-label="Backup needs attention"></span>':''}</button>
 </div>${driveReminderDue()?`<div class="weekly-drive-reminder" role="status">
   <div><strong>Monday Google Drive backup reminder</strong>
     <p>Keep a recovery copy outside this device. Save today's TyreDesk backup to your Google Drive.</p></div>
   <button type="button" class="button primary" data-action="backup-drive">Back up to Google Drive</button>
   <button type="button" class="button" data-action="backup-options">Backup options</button>
 </div>`:''}${next?`<p class="home-reminder-summary ${due.length?'is-due':''}">${I('bell')}<span><strong>${due.length?`${due.length} ${T('remindersDue')}`:T('remindersUpcoming')}</strong> · ${E(next.title)}</span></p>`:''}`;
}

function reminders(){
 const all=pendingReminders(),due=all.filter(r=>Date.parse(r.dueAt)<=Date.now()),upcoming=all.filter(r=>Date.parse(r.dueAt)>Date.now());
 const content=(items,title,urgent)=>items.length?`<section class="panel reminders-list"><div class="reminders-list-heading"><h3>${E(title)}</h3><span class="reminder-list-count ${urgent?'alert':''}">${items.length}</span></div>${items.map(r=>reminderRow(r)).join('')}</section>`:'';
 return header(T('reminders'),T('remindersPageIntro'),'WORKSHOP / TASKS',`<button class="button primary" data-action="add-reminder">${I('plus')} ${T('remindersAdd')}</button>`)+
   `<div class="reminders-page">${due.length?content(due,T('remindersDue'),true):''}${upcoming.length?content(upcoming,T('remindersUpcoming'),false):''}${!all.length?empty(T('remindersEmptyTitle'),T('remindersEmptyIntro'),'bell',`<button class="button primary" data-action="add-reminder">${I('plus')} ${T('remindersAdd')}</button>`):''}</div>`;
}

function reminderLocalDateTime(iso){const d=iso?new Date(iso):new Date(Date.now()+60*60*1000);const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}

function showReminderModal(r=null){
 const body=`<form id="reminder-form" data-id="${E(r?.id||'')}"><div class="field"><label for="reminder-title">${T('remindersTitle')} *</label><input id="reminder-title" name="title" maxlength="160" required autocomplete="off" placeholder="${E(T('remindersTitleHint'))}" value="${E(r?.title||'')}"></div><div class="field"><label for="reminder-due">${T('remindersDateTime')} *</label><input id="reminder-due" name="due" type="datetime-local" required value="${E(reminderLocalDateTime(r?.dueAt))}"></div><div class="field"><label for="reminder-notes">${T('remindersNotes')}</label><textarea id="reminder-notes" name="notes" rows="3" maxlength="1000" placeholder="${E(T('remindersNotesHint'))}">${E(r?.notes||'')}</textarea></div><p class="reminder-form-hint">${T('remindersFormHint')}</p></form>`;
 modal(r?T('remindersEdit'):T('remindersAdd'),'',body,modalButtons('reminder-form',T('save')),false);
}

function tickReminderIndicator(){
 if(!state.data?.settings||state.locked||document.visibilityState!=='visible'||state.modal)return;
 if(state.page==='dashboard'||state.page==='reminders'){render();return;}
 const button=document.querySelector('[data-reminder-bell]');
 if(!button)return;
 const count=dueReminders().length;
 button.classList.toggle('is-alert',count>0);
 button.setAttribute('aria-label',`${T('reminders')}: ${count} ${T('remindersDue')}`);
 button.innerHTML=I('bell')+(count?`<span class="reminder-bell-count">${count>99?'99+':count}</span>`:'');
}

let accountStep='signin',accountError='';
function render(){const app=$('#app');if(!state.data?.settings){app.innerHTML=(accountStep==='setup'?renderSetup():renderAccountEntry())+`<div id="modal-host">${state.modal||''}</div><div id="toasts" class="toast-stack"></div>`;return;}if(state.locked){app.innerHTML=renderLocked()+`<div id="toasts" class="toast-stack"></div>`;return;}
 const shop=state.data.settings;const pageTitles={dashboard:T('dashboard'),billing:T('billing'),customers:T('customers'),sales:T('sales'),dues:T('outstandingPayments'),catalog:T('catalog'),inventory:T('inventory'),expenses:T('expenses'),reports:T('reports'),reminders:T('reminders'),settings:T('settings')};
 app.innerHTML=`<div class="shell"><aside id="app-sidebar" class="sidebar ${state.menuOpen?'open':''}"><div class="brand"><div class="brand-mark">${I('wheel')}</div><div><div class="brand-name">TYRE<span>DESK</span></div><div class="brand-sub">WORKSHOP MANAGEMENT</div></div></div><div class="sidebar-mobile-head"><span>${T('allSections')}</span><button type="button" class="icon-button" data-action="close-menu" aria-label="${E(T('closeMenu'))}">${I('close')}</button></div><div class="nav-label">${T('workspace')}</div><div class="nav-items"><button type="button" class="nav-item ${state.page==='dashboard'?'active':''}" data-nav="dashboard">${I('grid')}${T('dashboard')}</button><button type="button" class="nav-item primary ${state.page==='billing'?'active':''}" data-nav="billing">${I('plus')}${T('billing')}${I('arrow','nav-arrow')}</button><button type="button" class="nav-item ${state.page==='customers'?'active':''}" data-nav="customers">${I('users')}${T('customers')}</button><button type="button" class="nav-item ${state.page==='sales'?'active':''}" data-nav="sales">${I('receipt')}${T('sales')}</button><button type="button" class="nav-item ${state.page==='dues'?'active':''}" data-nav="dues">${I('clock')}${T('outstandingPayments')}</button></div><div class="nav-label">${T('management')}</div><div class="nav-items"><button type="button" class="nav-item ${state.page==='catalog'?'active':''}" data-nav="catalog">${I('tag')}${T('catalog')}</button><button type="button" class="nav-item ${state.page==='inventory'?'active':''}" data-nav="inventory">${I('database')}${T('inventory')}</button><button type="button" class="nav-item ${state.page==='expenses'?'active':''}" data-nav="expenses">${I('wallet')}${T('expenses')}</button><button type="button" class="nav-item ${state.page==='reminders'?'active':''}" data-nav="reminders">${I('bell')}${T('reminders')}${dueReminders().length?'<span class="reminder-nav-count">'+dueReminders().length+'</span>':''}</button><button type="button" class="nav-item ${state.page==='reports'?'active':''}" data-nav="reports">${I('chart')}${T('reports')}</button><button type="button" class="nav-item ${state.page==='settings'?'active':''}" data-nav="settings">${I('settings')}${T('settings')}</button></div><div class="sidebar-backup"><button type="button" class="nav-item nav-backup" data-action="backup-drive" title="Save a recovery copy to Google Drive">${I('upload')}<span>Back Up to Google Drive</span>${I('arrow','nav-arrow')}</button><button type="button" class="nav-item nav-backup" data-action="restore-drive">${I('download')}<span>Restore from Google Drive</span></button><button type="button" class="nav-item nav-backup" data-action="backup">${I('download')}<span>Download Backup File</span></button><div class="sidebar-backup-status" data-backup-status>${E(backupStatusLine())}</div>${hostedPwa()?`<button type="button" class="backup-choose-folder" data-action="choose-backup-folder">${I('database')} <span data-backup-folder-label>${E(backupFolderActionLabel())}</span></button>`:nativeAndroid()&&!backupInfo.enabled?`<button type="button" class="backup-choose-folder" data-action="choose-backup-folder">${I('database')} Choose local backup folder</button>`:''}</div><div class="sidebar-bottom"><div class="sidebar-user"><div class="avatar">${E((shop.owner||shop.name).trim().slice(0,2).toUpperCase())}</div><div><strong>${E(shop.owner||shop.name)}</strong><small>${T('roleOwner')}</small></div></div></div></aside>${state.menuOpen?`<button type="button" class="sidebar-scrim" data-action="close-menu" aria-label="${E(T('closeMenu'))}"></button>`:''}<main class="main" data-page="${E(state.page)}"><div class="topbar"><div class="breadcrumbs"><button type="button" class="icon-button menu-toggle" data-action="menu">${I('menu')}</button><span>TYREDESK /</span><strong>${pageTitles[state.page]}</strong></div><div class="top-actions"><button type="button" class="reminder-bell ${dueReminders().length?'is-alert':''}" data-reminder-bell data-nav="reminders" aria-label="${E(T('reminders'))}: ${dueReminders().length} ${E(T('remindersDue'))}">${I('bell')}${dueReminders().length?'<span class="reminder-bell-count">'+(dueReminders().length>99?'99+':dueReminders().length)+'</span>':''}</button><div class="top-date">${fmtDate(new Date().toISOString())}</div><div class="top-avatar">${E((shop.owner||shop.name).trim().slice(0,2).toUpperCase())}</div></div></div><div class="page"><div data-update-banner>${updateBanner()}</div>${pageRender()}</div></main></div>${mobileNavigation()}<div id="modal-host">${state.modal||''}</div><div id="toasts" class="toast-stack"></div>`;
}
function mobileNavigation(){
 const items=[
  {page:'dashboard',icon:'grid',label:T('mobileHome')},
  {page:'customers',icon:'users',label:T('mobileCustomers')},
  {page:'billing',icon:'plus',label:T('mobileBill')},
  {page:'dues',icon:'clock',label:T('mobileDues')}
 ];
 const duesPending=activeOrders().some(o=>o.duePaise>0);
 return `<nav class="mobile-bottom-nav" aria-label="${E(T('mobileNavigation'))}"><div class="mobile-bottom-nav-inner">${items.map(item=>`<button type="button" class="mobile-nav-item ${item.page==='billing'?'mobile-nav-bill':''} ${state.page===item.page?'active':''}" data-nav="${item.page}" aria-label="${E(item.label)}" ${state.page===item.page?'aria-current="page"':''}><span class="mobile-nav-icon">${I(item.icon)}${item.page==='dues'&&duesPending?'<i class="mobile-nav-alert" aria-hidden="true"></i>':''}</span><span class="mobile-nav-label">${E(item.label)}</span></button>`).join('')}<button type="button" class="mobile-nav-item mobile-nav-menu ${state.menuOpen||!items.some(i=>i.page===state.page)?'active':''}" data-action="menu" aria-label="${E(T('mobileMenu'))}" aria-controls="app-sidebar" aria-expanded="${state.menuOpen?'true':'false'}"><span class="mobile-nav-icon">${I(state.menuOpen?'close':'menu')}</span><span class="mobile-nav-label">${E(state.menuOpen?T('closeMenu'):T('mobileMore'))}</span></button></div></nav>`;
}
async function nav(page){state.page=page;state.menuOpen=false;state.modal=null;document.documentElement.classList.remove('tyredesk-native-form-page');state.search='';if(page==='billing'&&!state.bill)startBill();render();window.scrollTo(0,0);if(state.data?.dashboard&&needsFullHistory(page))await refresh();}
// Native Android Back closes the current overlay before leaving the application.
window.TyreDeskCloseTopLayer=()=>{
 const legalDialog=$('dialog[data-legal-dialog][open]');
 if(legalDialog){legalDialog.close();return true;}
 if(state.modal){closeModal();return true;}
 if(state.menuOpen){state.menuOpen=false;render();return true;}
 return false;
};

function header(title,subtitle,eyebrow='WORKSHOP / OPERATIONS',actions=''){return `<header class="page-head"><div><div class="eyebrow">${E(eyebrow)}</div><h1>${E(title)}</h1><p>${E(subtitle)}</p></div>${actions?`<div class="page-head-actions">${actions}</div>`:''}</header>`;}
function pageRender(){if(state.data.dashboard&&needsFullHistory(state.page))return '<p role="status">Loading shop records…</p>';switch(state.page){case'dashboard':return dashboard();case'billing':return billing();case'customers':return customers();case'sales':return sales();case'dues':return outstandingPayments();case'catalog':return catalog();case'inventory':return inventory();case'expenses':return expenses();case'reminders':return reminders();case'reports':return reports();case'settings':return settings();default:return dashboard();}}
function empty(title,desc,icon='receipt',action=''){return `<div class="empty"><div class="empty-icon">${I(icon)}</div><h3>${E(title)}</h3><p>${E(desc)}</p>${action}</div>`;}
function statusBadge(s){const kind=s==='paid'?'green':s==='partial'?'gold':s==='cancelled'?'gray':'rose';return `<span class="badge ${kind}">${E(T(s==='paid'?'completed':s==='partial'?'partial':s==='cancelled'?'cancelled':'unpaid'))}</span>`;}
function stats(){const data=state.data;const orders=activeOrders();const td=todayISO();const mo=monthISO();const moneySum=a=>a.reduce((s,x)=>s+Number(x||0),0);return {todaySales:moneySum(orders.filter(o=>o.date===td).map(o=>o.totals.grandPaise)),monthSales:moneySum(orders.filter(o=>o.date.startsWith(mo)).map(o=>o.totals.grandPaise)),todayReceived:moneySum(data.payments.filter(p=>p.createdAt.slice(0,10)===td).map(p=>p.amountPaise)),pending:moneySum(orders.map(o=>o.duePaise)),monthlyExpenses:moneySum(data.expenses.filter(e=>e.date.startsWith(mo)).map(e=>e.amountPaise)),profit:estimateProfit(orders.filter(o=>o.date.startsWith(mo)),data.expenses.filter(e=>e.date.startsWith(mo))),customers:data.customerCount,orders:orders.length};}
function statCard(label,value,icon,accent,detail){return `<article class="stat-card"><div class="stat-top"><span>${E(label)}</span><span class="stat-icon ${accent}">${I(icon)}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${E(detail)}</div></article>`;}
function dailyGraph(orders){const nowDate=new Date();const days=Array.from({length:7},(_,i)=>{const d=new Date(nowDate);d.setDate(d.getDate()-(6-i));return {iso:todayISO(d),label:d.toLocaleDateString('en-IN',{weekday:'short'}),sum:0};});for(const o of orders) {const day=days.find(d=>d.iso===o.date);if(day)day.sum+=o.totals.grandPaise;}if(!days.some(d=>d.sum))return `<div class="chart-empty">${I('chart')}<p>${T('emptyChart')}</p></div>`;const max=Math.max(...days.map(d=>d.sum));return `<div class="chart">${days.map((d,i)=>`<div class="chart-column"><div class="chart-bar" data-money="${E(M(d.sum))}" style="height:${Math.max(d.sum?6:1,Math.round(d.sum/max*100))}%"></div><span class="chart-label">${d.label}</span></div>`).join('')}</div>`;}
function dashboard(){
 const s=stats(),shop=state.data.settings,orders=activeOrders().slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const low=state.data.catalog.filter(p=>isStockProduct(p)&&(p.stockQty||0)<=p.lowStockAt);
 const todayCount=orders.filter(o=>o.date===todayISO()).length;
 const primary=`<section class="dash-lead"><div class="dash-lead-copy"><div class="dash-lead-eyebrow"><span class="live-dot"></span> YOUR WORKSHOP · ${E(fmtDate(new Date().toISOString(),true))}</div><h1>${E(shop.name)}</h1><p>Everything you need for a productive day.</p><div class="dash-lead-actions"><button class="dash-action-new" data-nav="billing">${I('plus')} New bill ${I('arrow')}</button><button class="dash-action-outline" data-action="add-customer">${I('users')} Add customer</button></div></div><div class="dash-lead-today"><span>SALES TODAY</span><strong>${M(s.todaySales)}</strong><small>${todayCount} ${todayCount===1?'invoice':'invoices'} today</small></div></section>`;
 const tiles=`<div class="dash-metrics">${statCard('Est. profit',M(s.profit.estimatedProfitPaise),'chart','green','This month · after stock costs & expenses')}${statCard('This month',M(s.monthSales),'money','blue','Total billed this month')}${statCard('Customer dues',M(s.pending),'clock','gold','Unpaid balances')}${statCard('Active customers',String(s.customers),'users','orange','Saved customer profiles')}</div>`;
 const alertLines=`${s.pending>0?`<button type="button" class="dues-dashboard-link" data-nav="dues">${I('clock')}<span>${T('openOutstanding')} <strong>· ${M(s.pending)}</strong></span>${I('arrow')}</button>`:''}${low.length?`<button class="stock-alert" data-nav="inventory">${I('alert')}<span><strong>${T('lowStock')}</strong> · ${low.length} ${T('itemsNeedStock')}</span>${I('arrow')}</button>`:''}`;
 const chart=`<section class="panel"><div class="panel-header"><div><h3>${T('salesByDay')}</h3><small>LAST 7 DAYS · INVOICE VALUE</small></div><span class="badge gray">${T('live')}</span></div>${dailyGraph(orders)}</section>`;
 const actions=`<section class="panel quick-panel"><div class="panel-header"><div><h3>Quick actions</h3><small>Common workshop tasks</small></div></div><div class="panel-inner" style="padding-top:5px"><button class="quick-card" data-nav="billing"><span class="quick-symbol">${I('receipt')}</span><span class="quick-text"><strong>${T('newInvoice')}</strong><small>Create a receipt</small></span>${I('arrow','arrow')}</button><button class="quick-card" data-action="buy-tyres"><span class="quick-symbol green">${I('database')}</span><span class="quick-text"><strong>${T('addTyres')}</strong><small>Choose a tyre and enter the quantity</small></span>${I('arrow','arrow')}</button><button class="quick-card" data-nav="dues"><span class="quick-symbol blue">${I('clock')}</span><span class="quick-text"><strong>Collect payments</strong><small>View outstanding balances</small></span>${I('arrow','arrow')}</button><button class="quick-card" data-nav="reports"><span class="quick-symbol blue">${I('chart')}</span><span class="quick-text"><strong>Reports</strong><small>Review shop performance</small></span>${I('arrow','arrow')}</button><button class="quick-card" data-action="check-updates"><span class="quick-symbol blue">${I('download')}</span><span class="quick-text"><strong>Check for updates</strong><small>Check if a newer TyreDesk version is ready</small></span>${I('arrow','arrow')}</button></div></section>`;
 const recent=`<div class="section-caption"><h2>${T('recentInvoices')}</h2><button class="button-plain" data-nav="sales">${T('showAll')} ${I('chevron')}</button></div><section class="panel">${orders.length?orders.slice(0,6).map(o=>`<div class="invoice-list-row" data-invoice="${E(o.id)}"><span class="initial-icon">${I('receipt')}</span><span class="info"><strong>${E(o.customerSnapshot.name||'Walk-in customer')}</strong><small>${E(o.number)} · ${fmtDate(o.createdAt,true)} ${o.vehicle?'· '+E(o.vehicle):''}</small></span>${statusBadge(o.status)}<span class="right"><strong>${M(o.totals.grandPaise)}</strong><small>${o.duePaise?`${M(o.duePaise)} due`:T('completed')}</small></span></div>`).join(''):empty(T('noInvoices'),T('emptyState'),'receipt',`<button class="button primary" data-nav="billing">${I('plus')}${T('newInvoice')}</button>`)}</section>`;
 return `<div class="dash-page">${primary}${homeTools()}${billingPanel()}${tiles}${alertLines}<div class="board-grid">${chart}${actions}</div>${recent}</div>`;
}

function customers(){const d=state.data;const q=state.search.trim().toLowerCase();const filtered=d.customers.filter(c=>!q||[c.name,c.phone,...d.vehicles.filter(v=>v.customerId===c.id).map(v=>v.reg)].some(v=>String(v||'').toLowerCase().includes(q))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 return header(T('customers'),T('customersSubtitle'),'RELATIONSHIPS / PEOPLE',`<button class="button primary" data-action="add-customer">${I('plus')}${T('newCustomer')}</button>`)+`<div class="toolbar"><div class="searchbar">${I('search')}<input id="page-search" value="${E(state.search)}" placeholder="${E(T('searchPlaceholder'))}" aria-label="${E(T('search'))}" autocomplete="off"></div><div class="toolbar-end"><span class="badge gray">${d.customers.length} ${T('customers').toLowerCase()}</span><button class="button" data-action="export-customers">${I('download')}${T('exportCSV')}</button></div></div><section class="panel">${filtered.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>${T('customer')}</th><th>${T('contact')}</th><th>${T('vehicle')}</th><th>${T('invoices')}</th><th>${T('customerSpend')}</th><th></th></tr></thead><tbody>${filtered.slice(0,80).map(c=>{const orders=activeOrders().filter(o=>o.customerId===c.id);const vehicles=d.vehicles.filter(v=>v.customerId===c.id);return `<tr><td><span class="number">${E(c.name||'—')}</span><span class="subtext">${fmtDate(c.createdAt,true)}</span></td><td>${E(c.phone||'—')}</td><td>${E(vehicles.map(v=>v.reg).join(', ')||'—')}</td><td>${orders.length}</td><td class="number">${M(orders.reduce((n,o)=>n+o.totals.grandPaise,0))}</td><td><button class="button small" data-customer="${E(c.id)}">${T('details')} ${I('chevron')}</button></td></tr>`;}).join('')}</tbody></table></div><div class="table-foot">${filtered.length} results${filtered.length>80?' · Showing first 80':''}</div>`:empty(q?'No matches found':T('noCustomers'),q?'Try a different search.':T('emptyState'),'users',`<button class="button primary" data-action="add-customer">${I('plus')}${T('newCustomer')}</button>`)}</section>`;}
function sales(){const orders=state.data.orders.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));const q=state.search.toLowerCase();const filtered=orders.filter(o=>(state.salesStatus==='all'||o.status===state.salesStatus)&&(!q||[o.number,o.customerSnapshot?.name,o.customerSnapshot?.phone,o.vehicle].some(v=>String(v||'').toLowerCase().includes(q))));
 return header(T('sales'),T('salesHistory'),'SALES / LEDGER',`<button class="button primary" data-nav="billing">${I('plus')}${T('newInvoice')}</button>`)+`<div class="toolbar"><div class="searchbar">${I('search')}<input id="page-search" value="${E(state.search)}" placeholder="${T('searchPlaceholder')}"></div><div class="toolbar-end"><div class="field"><select id="sales-filter" class="control" aria-label="${T('filters')}"><option value="all">${T('all')}</option><option value="paid" ${state.salesStatus==='paid'?'selected':''}>${T('completed')}</option><option value="partial" ${state.salesStatus==='partial'?'selected':''}>${T('partial')}</option><option value="unpaid" ${state.salesStatus==='unpaid'?'selected':''}>${T('unpaid')}</option><option value="cancelled" ${state.salesStatus==='cancelled'?'selected':''}>${T('cancelled')}</option></select></div><button class="button" data-action="export-sales">${I('download')}${T('exportCSV')}</button></div></div><section class="panel">${filtered.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>${T('invoiceNumber')}</th><th>${T('customer')}</th><th>${T('date')}</th><th>${T('total')}</th><th>${T('due')}</th><th>${T('status')}</th><th></th></tr></thead><tbody>${filtered.slice(0,120).map(o=>`<tr><td><span class="number">${E(o.number)}</span><span class="subtext">${E(o.vehicle||'')}</span></td><td>${E(o.customerSnapshot?.name||'—')}<span class="subtext">${E(o.customerSnapshot?.phone||'')}</span></td><td>${fmtDate(o.createdAt,true)}</td><td class="number">${M(o.totals.grandPaise)}</td><td>${M(o.duePaise)}</td><td>${statusBadge(o.status)}</td><td><button class="button small" data-invoice="${E(o.id)}">${T('open')} ${I('chevron')}</button></td></tr>`).join('')}</tbody></table></div><div class="table-foot">${filtered.length} invoices${filtered.length>120?' · First 120 displayed':''}</div>`:empty(T('noInvoices'),T('emptyState'),'receipt',`<button class="button primary" data-nav="billing">${I('plus')}${T('createFirst')}</button>`)}</section>`;}
function outstandingPayments(){
 const dueOrders=state.data.orders.filter(o=>o.status!=='cancelled'&&Number(o.duePaise)>0)
  .slice().sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 const total=dueOrders.reduce((sum,o)=>sum+o.duePaise,0);
 const distinctCustomers=new Set(dueOrders.map(o=>o.customerId||o.customerSnapshot?.phone||o.number)).size;
 const term=state.search.trim().toLowerCase();
 const filtered=dueOrders.filter(o=>!term||[o.number,o.customerSnapshot?.name,o.customerSnapshot?.phone,o.vehicle,state.data.customers.find(c=>c.id===o.customerId)?.phone].some(v=>String(v||'').toLowerCase().includes(term)));
 const tiles=`<div class="dues-metrics"><div class="dues-metric featured"><span>${T('amountPending')}</span><strong>${M(total)}</strong><small>${T('outstandingPayments')}</small></div><div class="dues-metric"><span>${T('unpaidInvoices')}</span><strong>${dueOrders.length}</strong><small>${T('invoiceNumber')}</small></div><div class="dues-metric"><span>${T('customersWithDues')}</span><strong>${distinctCustomers}</strong><small>${T('customer')}</small></div></div>`;
 const listing=filtered.length?`<div class="dues-list">${filtered.slice(0,150).map(o=>{
   const customer=state.data.customers.find(c=>c.id===o.customerId);
   const phone=customer?.phone||o.customerSnapshot?.phone||'';
   const valid=whatsappRecipient(phone);
   const link=valid?whatsappReminderUrl(o,lang(),phone):'';
   return `<article class="dues-entry"><div class="dues-entry-main"><div class="dues-person"><div class="avatar">${E((o.customerSnapshot?.name||'C').slice(0,2).toUpperCase())}</div><div><strong>${E(o.customerSnapshot?.name||'Walk-in customer')}</strong><small>${E(phone||T('reminderNeedsPhone'))}</small></div></div><div class="dues-meta"><span>${E(o.number)} · ${fmtDate(o.createdAt,true)}</span><span>${E(o.vehicle||'')}</span></div></div><div class="dues-entry-right"><div class="dues-sum"><small>${T('amountPending')}</small><strong>${M(o.duePaise)}</strong></div><div class="dues-actions">${valid?`<a class="button whatsapp dues-whatsapp" href="${E(link)}" target="_blank" rel="noopener noreferrer" aria-label="${E(T('reminderWhatsApp'))}: ${E(o.customerSnapshot?.name||o.number)}">${I('message')}${T('reminderWhatsApp')}</a>`:`<span class="dues-missing-phone">${I('alert')} ${T('reminderNeedsPhone')}</span>`}<button type="button" class="button small" data-pay-order="${E(o.id)}">${I('money')}${T('collectPayment')}</button><button type="button" class="button small" data-invoice="${E(o.id)}">${T('openInvoice')}</button></div></div></article>`;
 }).join('')}</div>${filtered.length>150?`<div class="table-foot">${filtered.length} invoices · First 150 displayed</div>`:''}`:empty(T('noOutstanding'),T('emptyState'),'checkcircle');
 return header(T('outstandingPayments'),T('outstandingSubtitle'),'PAYMENTS / COLLECTIONS',`<button type="button" class="button" data-nav="sales">${I('receipt')}${T('sales')}</button>`)+tiles+`<section class="panel dues-panel"><div class="dues-toolbar"><div class="searchbar"><span>${I('search')}</span><input id="page-search" value="${E(state.search)}" placeholder="${E(T('searchPlaceholder'))}" aria-label="${E(T('search'))}"></div><div class="dues-guidance">${I('message')}${T('remindHelp')}</div></div>${listing}</section>`;
}

const shopCategories=()=>inventoryCategories(state.data.settings);
const customProducts=()=>state.data.catalog.filter(p=>p.type==='product'&&p.isActive!==false);
const stockName=p=>p.type==='tyre'?tyreName(p,shopMode(),state.data.settings):p.name;
const activeTyres=()=>state.data.catalog.filter(p=>p.type==='tyre'&&p.isActive!==false);
const shopMode=()=>inventoryMode(state.data.settings,state.data.catalog);
function purchaseHistory(){
 const purchases=state.data.purchases.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 if(!purchases.length)return '';
 return `<section class="panel inventory-history"><div class="panel-header"><h3>Purchase history</h3></div>
  <div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Tyre</th><th>Quantity</th><th>Cost per tyre</th><th>Supplier</th></tr></thead>
  <tbody>${purchases.map(p=>`<tr><td data-label="Date">${fmtDate(p.createdAt,true)}</td><td data-label="Tyre">${E(p.productName)}</td>
  <td data-label="Quantity">${p.qty}</td><td data-label="Cost per tyre">${M(p.costPaise)}</td><td data-label="Supplier">${E(p.supplier||'—')}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function inventory(){
 const allTyres=activeTyres(), mode=shopMode();
 const products=allTyres.filter(p=>!state.search||tyreSearchText(p,mode,state.data.settings).includes(state.search.toLowerCase())).sort((a,b)=>stockName(a).localeCompare(stockName(b)));
 const tracked=allTyres;
 const low=tracked.filter(p=>(p.stockQty||0)<=p.lowStockAt);
 const value=tracked.reduce((n,p)=>n+(p.stockQty||0)*(p.costPaise||0),0);
 const history=(state.data.inventoryMovements||[]).slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,30);
 return header(T('inventory'),T('inventorySub'),'TYRE INVENTORY / STOCK',`<button class="button" data-action="export-inventory">${I('download')}${T('exportCSV')}</button><button class="button primary" data-action="buy-tyres">${I('plus')}${T('addTyres')}</button>`)
 +`<div class="inventory-buy-guide"><div class="inventory-buy-guide-icon">${I('plus')}</div><div><strong>${T('addTyres')}</strong><p>${T('oneStockActionHelp')}</p></div></div>`
 +`<div class="stats inventory-stats">${statCard(T('tyresInStock'),tracked.reduce((n,p)=>n+(p.stockQty||0),0),'wheel','green',T('trackedQuantity'))}${statCard(T('lowStock'),low.length,'alert','orange',T('itemsNeedStock'))}${statCard(T('stockValue'),M(value),'money','blue',T('basedOnCost'))}</div>`
 +`<div class="toolbar"><div class="searchbar">${I('search')}<input id="page-search" value="${E(state.search)}" placeholder="${E(T('searchInventory'))}"></div><span class="badge gray">${products.length} ${T('tyres').toLowerCase()}</span></div>`
 +`<section class="panel"><div class="panel-header"><div><h3>${T('tyreProducts')}</h3><small>${T('stockUpdatedOnSale')}</small></div></div>${products.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Tyre</th><th>${T('currentStockColumn')}</th><th>${T('purchaseCost')}</th><th>${T('price')}</th><th>${T('status')}</th><th></th></tr></thead><tbody>${products.map(p=>`<tr><td><span class="number">${E(tyreName(p,mode,state.data.settings))}</span><span class="subtext">${E(p.supplier||'')}</span></td><td class="number">${p.stockQty||0}</td><td>${M(p.costPaise||0)}</td><td class="number">${M(p.pricePaise)}</td><td>${(p.stockQty||0)<=p.lowStockAt?`<span class="badge rose">${T('lowStock')}</span>`:`<span class="badge green">${T('inStock')}</span>`}</td><td><div class="inventory-actions"><button class="button small" data-restock="${E(p.id)}">Restock</button><button class="button small" data-edit-price="${E(p.id)}">${T('edit')}</button><button class="button small" data-stock-adjust="${E(p.id)}">${T('correctStock')}</button></div></td></tr>`).join('')}</tbody></table></div>`:empty(T('noTyres'),T('newTyreHelp'),'database')}</section>`
 +customInventory()
 +purchaseHistory()
 +`<section class="panel inventory-history"><div class="panel-header"><div><h3>${T('stockHistory')}</h3><small>${T('allMovements')}</small></div></div>${history.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>${T('date')}</th><th>${T('description')}</th><th>${T('type')}</th><th>${T('qty')}</th><th>${T('notes')}</th></tr></thead><tbody>${history.map(h=>`<tr><td>${fmtDate(h.createdAt,true)}</td><td><strong>${E(h.productName)}</strong></td><td>${E(h.type)}</td><td class="number ${h.delta<0?'stock-negative':'stock-positive'}">${h.delta>0?'+':''}${h.delta}</td><td>${E(h.note||'—')}</td></tr>`).join('')}</tbody></table></div>`:empty(T('noMovements'),T('startInventory'),'database')}</section>`;
}
function catalog(){const d=state.data,items=d.catalog.filter(p=>p.type==='service'&&p.isActive!==false).filter(p=>!state.search||[p.name,p.code,p.type].some(x=>String(x||'').toLowerCase().includes(state.search.toLowerCase()))).sort((a,b)=>a.name.localeCompare(b.name));
 return header(T('catalog'),T('catalogSubtitle'),'SERVICES / TYRE PRICES',`<button class="button primary" data-action="add-price">${I('plus')}${T('newPriceItem')}</button>`)+`<div class="toolbar"><div class="searchbar">${I('search')}<input id="page-search" value="${E(state.search)}" placeholder="Search your price list…"></div></div><section class="panel">${items.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>${T('description')}</th><th>${T('type')}</th><th>${T('price')}</th><th>${T('taxRate')}</th><th></th></tr></thead><tbody>${items.map(p=>`<tr><td><span class="number">${E(p.name)}</span></td><td><span class="badge ${p.type==='service'?'green':'gold'}">${T(p.type)}</span></td><td class="number">${M(p.pricePaise)}</td><td>${state.data.settings.gstRegistered?`${p.taxBps/100}%`:'—'}</td><td><button class="button small" data-edit-price="${E(p.id)}">${I('edit')}${T('edit')}</button></td></tr>`).join('')}</tbody></table></div>`:empty(T('noPriceItems'),T('catalogSubtitle'),'tag',`<button class="button primary" data-action="add-price">${I('plus')}${T('newPriceItem')}</button>`)}</section><div class="report-banner">${I('info')} ${T('taxWarning')} </div>`;}
function expenses(){const list=state.data.expenses.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));const q=state.search.toLowerCase();const filtered=list.filter(x=>!q||[x.category,x.description].some(v=>String(v||'').toLowerCase().includes(q)));const monthly=list.filter(e=>e.date.startsWith(monthISO())).reduce((a,e)=>a+e.amountPaise,0);
 return header(T('expenses'),T('expensesSubtitle'),'FINANCE / OPERATING COSTS',`<button class="button primary" data-action="add-expense">${I('plus')}${T('recordExpense')}</button>`)+`<div class="stats" style="grid-template-columns:repeat(2,minmax(0,1fr));max-width:650px">${statCard(T('totalExpenses'),M(monthly),'wallet','orange',T('thisMonth'))}${statCard('All recorded expenses',M(list.reduce((a,e)=>a+e.amountPaise,0)),'receipt','gold','Lifetime total')}</div><div class="toolbar"><div class="searchbar">${I('search')}<input id="page-search" value="${E(state.search)}" placeholder="Search expenses…"></div><button class="button" data-action="export-expenses">${I('download')}${T('exportCSV')}</button></div><section class="panel">${filtered.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>${T('date')}</th><th>${T('category')}</th><th>${T('description')}</th><th>${T('paymentMethod')}</th><th>${T('amount')}</th></tr></thead><tbody>${filtered.slice(0,120).map(e=>`<tr><td>${fmtDate(e.date,true)}</td><td><span class="number">${E(e.category)}</span></td><td>${E(e.description||'—')}</td><td>${E(T(e.method)||e.method)}</td><td class="number">${M(e.amountPaise)}</td></tr>`).join('')}</tbody></table></div>`:empty(T('noExpenses'),T('emptyState'),'wallet',`<button class="button primary" data-action="add-expense">${I('plus')}${T('recordExpense')}</button>`)}</section>`;}
function reportCalc(){const ord=activeOrders().filter(o=>o.date>=state.reportStart&&o.date<=state.reportEnd);const pay=state.data.payments.filter(p=>p.createdAt.slice(0,10)>=state.reportStart&&p.createdAt.slice(0,10)<=state.reportEnd);const exp=state.data.expenses.filter(e=>e.date>=state.reportStart&&e.date<=state.reportEnd);const lineType=(type)=>ord.reduce((n,o)=>n+o.items.filter(i=>i.type===type).reduce((t,l)=>t+l.totalPaise,0),0);const profit=estimateProfit(ord,exp);const cats=new Map();for(const o of ord)for(const item of o.items){cats.set(item.name,(cats.get(item.name)||0)+item.totalPaise);}return {orders:ord,payments:pay,expenses:exp,profit,sales:ord.reduce((n,o)=>n+o.totals.grandPaise,0),received:pay.reduce((n,p)=>n+p.amountPaise,0),spent:exp.reduce((n,e)=>n+e.amountPaise,0),discounts:ord.reduce((n,o)=>n+o.totals.itemDiscountPaise+o.totals.orderDiscountPaise,0),tyres:lineType('tyre'),services:lineType('service'),items:[...cats].sort((a,b)=>b[1]-a[1])};}
function reports(){const r=reportCalc(),max=Math.max(1,...r.items.map(x=>x[1]));return header(T('reports'),T('reportsSubtitle'),'BUSINESS / INSIGHTS',`<button class="button" data-action="export-reports">${I('download')}${T('exportCSV')}</button>`)+`<div class="toolbar"><div class="field-grid" style="max-width:420px;flex:1"><div class="field"><label for="report-from">${T('from')}</label><input id="report-from" type="date" value="${E(state.reportStart)}"></div><div class="field"><label for="report-to">${T('to')}</label><input id="report-to" type="date" value="${E(state.reportEnd)}"></div></div><span class="badge gray">${r.orders.length} ${T('invoices').toLowerCase()}</span></div><div class="report-strip">${statCard('Invoiced revenue',M(r.sales),'chart','orange','Completed invoices in period')}${statCard('Payments received',M(r.received),'wallet','green','Money actually received in period')}${statCard(T('totalExpenses'),M(r.spent),'receipt','gold','Operating costs in period')}</div><div class="report-strip">${statCard(T('tyreRevenue'),M(r.tyres),'wheel','blue','Invoiced tyre-line revenue')}${statCard(T('serviceRevenue'),M(r.services),'bolt','green','Invoiced service-line revenue')}${statCard(T('estimatedProfit'),M(r.profit.estimatedProfitPaise),'chart','green',T('profitAfterCosts'))}</div><div class="board-grid"><section class="panel"><div class="panel-header"><div><h3>Top services & tyre lines</h3><small>RANKED BY INVOICED VALUE</small></div></div>${r.items.length?`<div class="report-list">${r.items.slice(0,9).map(([k,v])=>`<div class="report-graph-row"><small title="${E(k)}">${E(k.length>15?k.slice(0,15)+'…':k)}</small><div class="track"><div class="fill" style="width:${Math.max(1,v/max*100)}%"></div></div><strong>${M(v)}</strong></div>`).join('')}</div>`:empty(T('noSales'),T('emptyChart'),'chart')}</section><section class="panel"><div class="panel-header"><div><h3>${T('financialSummary')}</h3><small>THE PERIOD AT A GLANCE</small></div></div><div class="panel-inner"><div class="detail-list"><div class="detail-row"><span>Invoices created</span><strong>${r.orders.length}</strong></div><div class="detail-row"><span>Invoiced sales</span><strong>${M(r.sales)}</strong></div><div class="detail-row"><span>Received payments</span><strong>${M(r.received)}</strong></div><div class="detail-row"><span>${T('purchaseCostsSold')}</span><strong>${M(r.profit.tyreCostPaise)}</strong></div><div class="detail-row"><span>Operating expenses</span><strong>${M(r.spent)}</strong></div><div class="detail-row"><span>${T('estimatedProfit')}</span><strong>${M(r.profit.estimatedProfitPaise)}</strong></div><div class="detail-row"><span>Payments less expenses</span><strong>${M(r.received-r.spent)}</strong></div></div><p class="report-banner">${T('profitNote')}${r.profit.missingCostLines?' '+r.profit.missingCostLines+' '+T('costMissingWarning'):''}</p></div></section></div>`;}
function newLine(product=null){return {key:uid(),catalogId:product?.id||null,type:product?.type||'service',name:product?.name||'',code:product?.code||'',qty:1,unitPaise:product?.pricePaise||0,taxBps:product?.taxBps||0,discount:{type:'fixed',value:0}};}
function billValues(){const b=state.bill;if(!b)return null;try{const discount=b.billDiscountType==='percent'?{type:'percent',value:Math.round(Number(b.billDiscountValue||0)*100)}:{type:'fixed',value:toPaise(b.billDiscountValue||0)};const calculated=calculateBill(b.lines,discount,{registered:b.editing?!!state.data.orders.find(o=>o.id===b.editing)?.shopSnapshot?.gstRegistered:state.data.settings.gstRegistered,supplyMode:b.supplyMode});const paid=toPaise(b.paid||0)+(b.draftReceipts||[]).reduce((sum,p)=>sum+p.amountPaise,0);if(!Number.isSafeInteger(paid)||paid<0||paid>calculated.totals.grandPaise)throw Error('Payment must be between zero and the bill total.');return {calculated,discount,paid,due:calculated.totals.grandPaise-paid,error:null};}catch(e){return {calculated:null,discount:null,paid:0,due:0,error:e.message};}}
function lineMarkup(line){
 const percent=line.discount.type==='percent';
 return `<details class="compact-bill-line" data-line="${E(line.key)}" ${line.expanded?'open':''}>
  <summary><span><strong data-line-name>${E(line.name||'New service')}</strong>
  <span data-line-caption>${line.type==='service'?'Service charge: '+M(line.qty*line.unitPaise):line.qty+' × '+M(line.unitPaise)}</span></span><strong id="line-amount-${E(line.key)}">—</strong></summary>
  <div class="line-editor">
   ${line.catalogId&&isStockProduct(line)?'':`<label class="field field-spread">Description<input data-line-field="name" value="${E(line.name)}"></label>`}
   ${line.type==='service'?'':`<label class="field">Quantity<input type="number" min="1" max="9999" data-line-field="qty" value="${line.qty}"></label>`}
   <label class="field">${line.type==='service'?'Service price (₹)':'Price per item (₹)'}<input type="number" min="0" step="0.01" data-line-field="unitPaise" value="${amountField(line.unitPaise)}"></label>
   <div class="field"><label for="line-discount-${E(line.key)}">Discount</label><div class="discount-inline">
    <input id="line-discount-${E(line.key)}" type="number" min="0" step="0.01" data-line-field="discountValue" value="${percent?line.discount.value/100:amountField(line.discount.value)}">
    <select data-line-field="discountType" aria-label="Discount type"><option value="fixed" ${percent?'':'selected'}>₹</option><option value="percent" ${percent?'selected':''}>%</option></select>
   </div></div>
   ${state.data.settings.gstRegistered?`<label class="field">GST (%)<input data-line-field="taxBps" type="number" min="0" max="100" step="0.01" value="${line.taxBps/100}"></label>`:''}
   <button type="button" class="button small" data-remove-line="${E(line.key)}">Remove item</button>
  </div></details>`;
}
function billing(){const b=state.bill||((startBill()),state.bill);const prices=state.data.catalog.filter(p=>p.isActive!==false&&p.type==='service');const hidden=canBill()?'':'hidden';return header(b.editing?'Edit invoice':'New bill','', '',`${b.editing?'<button type="button" class="button" data-action="discard-invoice-edit">Discard changes</button>':`<button type="button" class="button primary" data-action="draft-show-qr" data-billing-editor ${hidden}>Show payment QR</button>`}<button class="button" data-nav="sales">${I('receipt')}${T('allInvoices')}</button>`)+billingPanel()+`<div class="bill-layout" data-billing-editor ${hidden}><div class="bill-main"><section class="bill-section"><div class="bill-section-title"><h2>${T('customerDetails')}</h2><small>${T('newCustomerHint')}</small></div>${b.selectedCustomerId?renderSelectedCustomer():`<div class="field form-section customer-lookup-field"><label for="customer-lookup">${T('searchCustomer')}</label><div class="searchbar" style="max-width:none;width:100%;height:46px">${I('search')}<input id="customer-lookup" autocomplete="off" value="${E(b.customerQuery)}" placeholder="${E(T('searchPlaceholder'))}"></div><div id="customer-suggestions"></div><small>${T('customerLookupHelp')}</small></div><div class="field-grid"><div class="field"><label for="bill-customer-name">${T('name')}</label><input id="bill-customer-name" value="${E(b.customerName)}" placeholder="e.g. Rahul Patil"></div><div class="field"><label for="bill-customer-phone">${T('phone')} <span class="optional">(${T('optional')})</span></label><input id="bill-customer-phone" type="tel" inputmode="tel" value="${E(b.customerPhone)}" placeholder="10-digit mobile number"></div></div>`}<div class="field" style="margin-top:17px"><label for="bill-vehicle">${T('newVehicle')}</label><input id="bill-vehicle" value="${E(b.vehicle)}" placeholder="MH 21 AB 1234" style="text-transform:uppercase" maxlength="18"></div></section><section class="bill-section"><div class="bill-section-title"><h2>${T('invoiceItems')}</h2></div><h3>Tyres</h3>${shopMode()?tyrePicker(shopMode(),activeTyres(),state.data.settings):'<button type="button" class="button" data-action="inventory-mode-settings">Choose inventory mode</button>'}
 ${customBillPicker()}
 <h3>Services</h3>${prices.length?`<label class="field">Saved services<select id="bill-service"><option value="">Choose a service</option>${prices.map(p=>`<option value="${E(p.id)}">${E(p.name)} · ${M(p.pricePaise)}</option>`).join('')}</select></label>`:''}
 <div id="bill-lines">${b.lines.length?b.lines.map(lineMarkup).join(''):`<div class="empty compact"><div class="empty-icon">${I('plus')}</div><h3>${T('noItems')}</h3></div>`}</div><button type="button" class="bill-add" data-action="add-line">${I('plus')}Add a service</button></section><section class="bill-section"><div class="bill-section-title"><h2>${T('payments')} & ${T('discount')}</h2></div><div class="field-grid"><div class="field"><label>${T('billDiscount')}</label><div style="display:flex;gap:8px"><input id="bill-discount-value" type="number" min="0" step="0.01" value="${E(b.billDiscountValue)}"><select id="bill-discount-type" style="width:90px"><option value="fixed" ${b.billDiscountType==='fixed'?'selected':''}>₹</option><option value="percent" ${b.billDiscountType==='percent'?'selected':''}>%</option></select></div></div><div class="field"><label for="bill-paid">${T('paid')} (₹)</label><input id="bill-paid" type="number" min="0" step="0.01" value="${E(b.paid)}"></div><div class="field"><label for="bill-method">${T('paymentMethod')}</label><select id="bill-method"><option value="cash" ${b.method==='cash'?'selected':''}>${T('cash')}</option><option value="upi" ${b.method==='upi'?'selected':''}>${T('upi')}</option><option value="card" ${b.method==='card'?'selected':''}>${T('card')}</option><option value="other" ${b.method==='other'?'selected':''}>${T('other')}</option></select></div><div class="field"><label for="bill-reference">${T('reference')} <span class="optional">(${T('optional')})</span></label><input id="bill-reference" value="${E(b.paymentReference)}" placeholder="UPI / transaction ID"></div>${state.data.settings.gstRegistered?`<div class="field field-spread"><label for="bill-supply">${T('supplyType')}</label><select id="bill-supply"><option value="intra" ${b.supplyMode==='intra'?'selected':''}>${T('intraState')}</option><option value="inter" ${b.supplyMode==='inter'?'selected':''}>${T('interState')}</option></select><small>${T('taxWarning')}</small></div>`:''}<div class="field field-spread"><label for="bill-notes">${T('notes')} <span class="optional">(${T('optional')})</span></label><textarea id="bill-notes" rows="2" placeholder="Thank you / customer instructions…">${E(b.notes)}</textarea></div></div></section></div><aside class="bill-summary"><div class="summary-card"><div class="summary-head"><strong>Bill summary</strong></div><div id="bill-summary-dynamic"></div><section id="bill-payment-qr" aria-label="Shop payment QR"></section><button class="button primary large" id="save-bill" data-action="save-bill">${I('checkcircle')}${b.editing?'Save changes':T('saveAndView')}${I('arrow')}</button><div class="summary-hint">${I('shield')}<span>New customer profiles are created when the bill is saved.</span></div></div></aside></div>`;}
function renderSelectedCustomer(){const b=state.bill;const c=state.data.customers.find(x=>x.id===b.selectedCustomerId)||b.selectedCustomer||{name:b.customerName,phone:b.customerPhone};const vehicles=b.selectedCustomer?.vehicles?.map(v=>v.reg).join(', ')||state.data.vehicles.filter(x=>x.customerId===b.selectedCustomerId).map(x=>x.reg).join(', ');return `<div class="customer-chosen">${I('checkcircle')}<div><strong>${E(c.name||c.phone)}</strong><small>${E(c.phone)} ${vehicles?'· '+E(vehicles):''}</small></div><button type="button" class="button small" data-action="clear-customer">${T('clearSelection')}</button></div>`;}
document.addEventListener('toggle',event=>{
 const line=state.bill?.lines.find(l=>l.key===event.target.dataset?.line);
 if(line)line.expanded=event.target.open;
},true);
function updateBillTotals(){const host=$('#bill-summary-dynamic');if(!host||!state.bill)return;for(const line of state.bill.lines){
 const row=host.ownerDocument.querySelector(`[data-line="${E(line.key)}"]`);
 if(row){row.querySelector('[data-line-name]').textContent=line.name||'New service';row.querySelector('[data-line-caption]').textContent=line.type==='service'
   ?'Service charge: '+M(line.qty*line.unitPaise):`${line.qty} × ${M(line.unitPaise)}`;}
 }
 if(state.bill.editing){
   const amount=$('#bill-paid');
   if(amount){for(const control of ['#bill-paid','#bill-method','#bill-reference'])$(control).disabled=true;}
   for(const control of ['#bill-customer-name','#bill-customer-phone','#bill-vehicle','#customer-lookup','[data-action=clear-customer]']){
     const field=$(control);if(field)field.disabled=true;
   }
 }
 const val=billValues();let rendered;if(val.calculated){const tt=val.calculated.totals;rendered=`<div class="summary-row"><span>${T('subtotal')}</span><strong>${M(tt.subtotalPaise)}</strong></div>${tt.itemDiscountPaise?`<div class="summary-row"><span>Item ${T('discount')}</span><strong>− ${M(tt.itemDiscountPaise)}</strong></div>`:''}${tt.orderDiscountPaise?`<div class="summary-row"><span>${T('billDiscount')}</span><strong>− ${M(tt.orderDiscountPaise)}</strong></div>`:''}${state.data.settings.gstRegistered?`<div class="summary-row"><span>${T('tax')}</span><strong>${M(tt.taxPaise)}</strong></div>`:''}<div class="summary-total"><small>${T('grandTotal')}</small><strong>${M(tt.grandPaise)}</strong></div><div class="summary-due"><span>${T('due')}</span><b>${M(val.due)}</b></div>`;const calculated=val.calculated;for(let i=0;i<state.bill.lines.length;i++){const el=document.getElementById('line-amount-'+state.bill.lines[i].key);if(el)el.textContent=M(calculated.lines[i].totalPaise);}}
 else{rendered=`<div class="summary-row"><span>${T('noItems')}</span></div><div class="summary-total"><small>${T('grandTotal')}</small><strong>${M(0)}</strong></div><div class="summary-due"><span>${E(val.error||'')}</span><b>—</b></div>`;}host.innerHTML=rendered;$('#bill-payment-qr').hidden=!!state.bill.editing;if(!state.bill.editing)$('#bill-payment-qr').innerHTML=draftQr(val);$('#save-bill').disabled=!!val.error||state.bill.saving;}
function rerenderBillLines(){const host=$('#bill-lines');if(!host)return;host.innerHTML=state.bill.lines.length?state.bill.lines.map(lineMarkup).join(''):`<div class="empty compact"><div class="empty-icon">${I('plus')}</div><h3>${T('noItems')}</h3></div>`;updateBillTotals();}
async function loadCustomerSuggestions(q){const host=$('#customer-suggestions');if(!host)return;if(q.trim().length<2){host.innerHTML='';return;}const at=q;const matches=await searchCustomers(q,9);if(state.bill?.customerQuery!==at||!$('#customer-suggestions'))return;host.innerHTML=`<div class="suggest-box flow">${matches.length?`<div class="suggest-help">${T('chooseCustomer')}</div>${matches.map(c=>`<button type="button" class="suggest-item" data-select-customer="${E(c.id)}"><span class="avatar">${E((c.name||c.phone).slice(0,2).toUpperCase())}</span><span><strong>${E(c.name||c.phone)}</strong><small>${E([c.phone,...c.vehicles.map(v=>v.reg)].filter(Boolean).join(' · '))}</small></span></button>`).join('')}`:`<div class="suggest-box flow"><div class="suggest-empty">${T('noMatchContinue')}</div></div>`}</div>`;}
function setupFrame(content){return `<main class="setup"><section class="setup-showcase"><div class="showcase-logo"><div class="brand-mark">${I('wheel')}</div><span>TYRE<span>DESK</span></span></div><div class="showcase-copy"><div class="eyebrow">THE WORKSHOP, IN ORDER</div><h1>${T('onboardTitle').replace('Beautifully managed.','<em>Beautifully managed.</em>')}</h1><p>${T('onboardSub')}</p></div></section><section class="setup-form-area"><div data-update-banner>${updateBanner()}</div>${content}</section></main>`;}
function serviceSetupRow(){
 return `<div class="field-grid setup-service">
 <label class="field">Service name<input name="serviceName" maxlength="150" placeholder="e.g. Wheel alignment"></label>
 <label class="field">Default price (₹, optional)<input name="servicePrice" type="number" min="0" step=".01"></label>
 <button type="button" class="button small" data-action="setup-remove-service">Remove service</button></div>`;
}
function serviceSetupPanel(){
 return `<section class="setup-services" aria-labelledby="setup-services-title"><h3 id="setup-services-title">What services do you provide?</h3>
 <p>Add the services you want to select on invoices. You can change them later in Settings.</p>
 <div id="setup-services-list">${serviceSetupRow()}</div>
 <button type="button" class="button" data-action="setup-add-service">${I('plus')}Add another service</button></section>`;
}
function initialServices(formData){
 const names=formData.getAll('serviceName'),prices=formData.getAll('servicePrice');
 const added=new Set(),services=[];
 const timestamp=now();
 for(const [i,raw] of names.entries()){
   const name=String(raw).trim().replace(/\s+/g,' ');
   const price=String(prices[i]||'').trim();
   if(!name&&!price)continue;
   const key=name.normalize('NFKC').toLowerCase();
   const pricePaise=price?toPaise(price):0;
   if(!name||name.length>150||!Number.isSafeInteger(pricePaise)||pricePaise<0)throw Error('Enter a service name and a valid price, or leave the price blank.');
   if(added.has(key))throw Error('Enter each service once.');
   added.add(key);
   services.push({id:uid(),type:'service',name,searchName:key,pricePaise,taxBps:0,
     isActive:true,trackStock:false,stockQty:0,costPaise:0,createdAt:timestamp,updatedAt:timestamp});
 }
 if(services.length>50)throw Error('Add up to 50 services during setup. You can add more in Settings.');
 return services;
}

function tyreSetupFields(){
 return `<section class="setting-panel" data-setup-tyre-fields hidden>
  <h3>Which tyre details does this shop use?</h3>
  <p>Brand is always required. Keep, rename, remove, or add other tyre identifiers. These fields appear in inventory and billing. <strong>This choice is permanent when you create the shop.</strong></p>
  <div class="field-grid" data-setup-tyre-rows>
    ${defaultTyreFields().map(f=>`<div class="field field-spread setup-tyre-field" data-setup-tyre-field data-field-id="${E(f.id)}">
      <label>Field name<input name="tyreField" maxlength="60" required value="${E(f.label)}" placeholder="e.g. Color or Product Code"></label>
      <button type="button" class="button small" data-action="setup-remove-tyre-field">Remove field</button>
    </div>`).join('')}
  </div>
  <button type="button" class="button" data-action="setup-add-tyre-field">Add different category</button>
 </section>`;
}
function renderSetup(){return setupFrame(`<form class="setup-form" id="setup-form"><div class="setup-progress">${I('wheel')}${T('onboardStep')}</div><h2>${T('onboardCreate')}</h2><p>Set up your shop once. You can update these details in Settings.</p><button type="button" class="button large" data-action="restore-drive">${I('upload')} Restore from Google Drive backup</button><p class="small-muted">Already used TyreDesk? Restore your previous shop instead of setting it up again.</p><input id="restore-file" type="file" accept=".json,application/json" hidden><div class="field-grid"><div class="field field-spread"><label>${T('businessName')} *</label><input name="name" required maxlength="100" placeholder="e.g. Your Tyre & Alignment Centre" autofocus></div><div class="field"><label>${T('ownerName')} *</label><input name="owner" required maxlength="70" placeholder="Owner's name"></div><div class="field"><label>${T('phone')} *</label><input name="phone" type="tel" required maxlength="20" placeholder="Shop contact"></div><div class="field field-spread"><label>${T('address')}</label><input name="address" maxlength="160" placeholder="Street, shop number, locality"></div><div class="field"><label>${T('city')}</label><input name="city" maxlength="65" placeholder="e.g. Jalna"></div><div class="field"><label>${T('state')}</label><input name="state" maxlength="65" value="Maharashtra"></div><div class="field"><label>${T('language')}</label><select name="language"><option value="en">English</option><option value="hi">हिंदी</option><option value="mr">मराठी</option></select></div><div class="field"><label>${T('prefix')}</label><input name="invoicePrefix" value="INV" maxlength="12" placeholder="INV"></div><div class="field"><label>${T('gstRegistered')}</label><select name="gstRegistered"><option value="false">${T('unregistered')}</option><option value="true">${T('registered')}</option></select></div><div class="field"><label>${T('gstin')} <span class="optional">(${T('optional')})</span></label><input name="gstin" maxlength="15" placeholder="15-character GSTIN"></div><div class="field"><label>${T('password')} *</label><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,12}" minlength="4" maxlength="12" required autocomplete="new-password" placeholder="4–12 digits"><small>${T('ownerPinHelp')}</small></div><div class="field"><label>${T('confirmPassword')} *</label><input name="confirmPin" type="password" inputmode="numeric" pattern="[0-9]{4,12}" minlength="4" maxlength="12" required placeholder="Repeat PIN"></div></div>${modeChoices()}${tyreSetupFields()}${serviceSetupPanel()}<div class="consent"><label><input type="checkbox" name="legalConsent" required> I am authorised to set up this shop, agree to the TyreDesk Terms &amp; Conditions and acknowledge the Privacy Policy.</label><p>Read ${legalLinks()}. Acceptance is required to create a new shop.</p></div><button class="button primary large" type="submit">${T('onboardCreate')} ${I('arrow')}</button><div class="setup-foot">${I('lock')} ${T('securityNote')}</div></form>`);}
function renderLocked(){const shop=state.data.settings;return `<main class="lock-layout"><div class="lock-art"><div class="showcase-logo"><div class="brand-mark">${I('wheel')}</div><span>TYRE<span>DESK</span></span></div></div><div class="lock-card"><div data-update-banner>${updateBanner()}</div><div class="eyebrow">SECURE WORKSPACE</div><h1>${T('locked')}.</h1><p>${E(shop.name)} · ${T('pinPrompt')}</p><form id="unlock-form"><div class="field"><label>${T('password')}</label><input type="password" name="pin" autocomplete="off" inputmode="numeric" pattern="[0-9]{4,12}" minlength="4" maxlength="12" required autofocus placeholder="••••••"></div><button class="button primary large" type="submit">${I('lock')}${T('unlockBtn')}${I('arrow')}</button></form></div></main>`;}
function inventoryModePanel(){
 const mode=shopMode();
 if(state.data.settings?.inventoryMode){
   return `<section class="setting-panel"><h2>Inventory Mode</h2>
     <p><strong>${mode==='simple'?'Simple':'Detailed'} Inventory</strong></p>
     <p class="small-muted">This choice is permanent after business setup to protect stock identities and billing history.</p>
   </section>`;
 }
 return `<section class="setting-panel"><h2>Inventory Mode</h2>
   <form id="inventory-mode-form">${modeChoices(mode,false)}
     <button type="submit" class="button primary">Choose inventory mode permanently</button>
   </form></section>`;
}
function settings(){const s=state.data.settings;return header(T('settings'),T('settingsSubtitle'),'PREFERENCES / OWNERSHIP')+`<div class="settings-grid"><div>${cloudPanel()}${updatePanel()}${inventoryModePanel()}${categoriesPanel()}${servicesSettingsPanel()}<section class="setting-panel"><h2>${T('shopProfile')}</h2><p class="lead">Business details are captured on every new invoice. Historical invoices keep their original business details.</p><form id="settings-form"><div class="field-grid"><div class="field field-spread"><label>${T('businessName')}</label><input name="name" required value="${E(s.name)}"></div><div class="field"><label>${T('ownerName')}</label><input name="owner" required value="${E(s.owner)}"></div><div class="field"><label>${T('phone')}</label><input name="phone" required value="${E(s.phone)}"></div><div class="field"><label>${T('whatsapp')}</label><input name="whatsapp" value="${E(s.whatsapp||'')}"></div><div class="field"><label>${T('address')}</label><input name="address" value="${E(s.address||'')}"></div><div class="field"><label>${T('city')}</label><input name="city" value="${E(s.city||'')}"></div><div class="field"><label>${T('state')}</label><input name="state" value="${E(s.state||'')}"></div><div class="field"><label>${T('prefix')}</label><input name="invoicePrefix" value="${E(s.invoicePrefix||'INV')}"></div><div class="field"><label>${T('gstRegistered')}</label><select name="gstRegistered"><option value="false" ${!s.gstRegistered?'selected':''}>${T('unregistered')}</option><option value="true" ${s.gstRegistered?'selected':''}>${T('registered')}</option></select></div><div class="field"><label>${T('gstin')}</label><input name="gstin" maxlength="15" value="${E(s.gstin||'')}"></div><div class="field field-spread"><label>${T('terms')}</label><textarea name="terms" placeholder="Optional service terms, warranty notes…">${E(s.terms||'')}</textarea></div><div class="field field-spread"><label for="payment-qr-file">Shop payment QR (UPI image)</label><input id="payment-qr-file" name="paymentQr" type="file" accept="image/png,image/jpeg,image/webp"><small>PNG, JPG or WebP, up to 5 MB. Use a clear, complete QR with its white border. Verify the recipient in your payment app. Synced with shop settings and included in backups.</small>${s.paymentQrData?'<img class="qr-settings-preview" src="'+E(s.paymentQrData)+'" alt="Shop payment QR"><label><input name="removeQr" type="checkbox"> Remove payment QR</label>':''}</div></div><button class="button primary settings-save" type="submit">${I('check')}${T('saveChanges')}</button></form></section><section class="setting-panel"><h2>${T('language')} & ${T('theme')}</h2><p class="lead">Switch the application language or appearance instantly.</p><div class="field-grid"><div class="field"><label>${T('language')}</label><select id="setting-language"><option value="en" ${s.language==='en'?'selected':''}>English</option><option value="hi" ${s.language==='hi'?'selected':''}>हिंदी</option><option value="mr" ${s.language==='mr'?'selected':''}>मराठी</option></select></div><div class="field"><label>${T('theme')}</label><select id="setting-theme"><option value="light" ${(s.theme||'light')==='light'?'selected':''}>${T('light')}</option><option value="dark" ${s.theme==='dark'?'selected':''}>${T('dark')}</option></select></div></div></section></div><div id="backup-settings">${backupSettingsCard()}<section class="setting-panel"><h2>${T('backupRestore')}</h2><p class="lead">${T('backupHint')}</p><div class="setting-actions"><button class="setting-action" data-action="backup-drive">${I('upload')}<span><strong>Back Up to Google Drive</strong><small>Keep a copy safely outside this device</small></span>${I('chevron','trailing')}</button><button class="setting-action" data-action="restore-drive">${I('download')}<span><strong>Restore from Google Drive</strong><small>Recover a shop on this or a new device</small></span>${I('chevron','trailing')}</button><button class="setting-action" data-action="backup">${I('download')}<span><strong>${T('backup')}</strong><small>Export full verified JSON archive</small></span>${I('chevron','trailing')}</button><button class="setting-action" data-action="restore">${I('upload')}<span><strong>${T('restore')}</strong><small>Validate and atomically replace the data</small></span>${I('chevron','trailing')}</button><input id="restore-file" type="file" accept=".json,application/json" hidden></div><div class="muted-note" style="margin-top:18px">${I('alert')} ${T('restoreWarning')}</div></section><section class="setting-panel"><h2>${T('security')}</h2><p class="lead">${T('securityNote')}</p><div class="setting-actions"><button class="setting-action" data-action="change-pin">${I('lock')}<span><strong>${T('changePassword')}</strong><small>Current PIN required</small></span>${I('chevron','trailing')}</button><button class="setting-action" data-action="persist-storage">${I('shield')}<span><strong>Request protected storage</strong><small>Ask browser not to evict local records</small></span>${I('chevron','trailing')}</button>${nativeAndroid()?'':`<button class="setting-action" data-action="install">${I('mobile')}<span><strong>${T('install')}</strong><small>Make this an app on your device</small></span>${I('chevron','trailing')}</button>`}</div></section><section class="setting-panel"><h2>Terms &amp; Privacy</h2><p>${legalLinks()}</p><p class="small-muted">${s.legalConsent?'Accepted version '+E(s.legalConsent.termsVersion)+' on '+E(new Date(s.legalConsent.acceptedAt).toLocaleString('en-IN')):'This shop predates consent recording; no acceptance has been assumed.'}</p></section></div></div>`;}
// Android's keyboard already scrolls the invoice page correctly. Use that
// same document-level scrolling for long editable forms, not fixed nested modals.
let nativeFormReturnY=0;
function modal(title,subtitle,body,footer='',wide=false,variant=''){
 const useNativeFormPage=nativeAndroid()&&/<form\b[^>]*\bid="(?:purchase-form|reminder-form|expense-form)"/.test(body);
 if(useNativeFormPage&&!document.documentElement.classList.contains('tyredesk-native-form-page'))nativeFormReturnY=window.scrollY;
 document.documentElement.classList.toggle('tyredesk-native-form-page',useNativeFormPage);
 state.modal=`<div class="overlay ${variant}" data-close-modal><div class="modal ${wide?'xl':''}" role="dialog" aria-modal="true"><div class="modal-head"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-button" data-action="close-modal" aria-label="Close">${I('close')}</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}</div></div>`;
 const h=$('#modal-host');if(h)h.innerHTML=state.modal;
 if(useNativeFormPage)requestAnimationFrame(()=>window.scrollTo(0,0));
}
function closeModal(){
 const wasNativeFormPage=document.documentElement.classList.contains('tyredesk-native-form-page');
 state.modal=null;const h=$('#modal-host');if(h)h.innerHTML='';
 document.documentElement.classList.remove('tyredesk-native-form-page');
 if(wasNativeFormPage)requestAnimationFrame(()=>window.scrollTo(0,nativeFormReturnY));
}
function showBackupOptions(){
 const due=driveReminderDue();
 modal('Backup','',`<div class="setting-actions">
    <p class="small-muted" data-backup-status>${E(backupStatusLine())}</p>
    ${due?'<p class="small-muted">Monday reminder: save your weekly recovery copy to Google Drive.</p>':''}
    <button type="button" class="button primary" data-action="backup-drive">${I('upload')}Back up to Google Drive</button>
    <button type="button" class="button" data-action="backup">${I('download')}Download backup</button>
    <button type="button" class="button" data-action="backup-settings">${I('settings')}Backup settings</button>
 </div>`,due?`<button type="button" class="button" data-action="confirm-drive-backup">I saved a Google Drive backup</button>
    <button type="button" class="button" data-action="dismiss-drive-reminder">Dismiss for this Monday</button>`:'');
}
function modalButtons(submitId,label=T('save')){return `<button class="button" data-action="close-modal">${T('cancel')}</button><button type="submit" class="button primary" form="${submitId}">${I('check')}${label}</button>`;}
function showCustomerModal(c=null){const vehicles=c?state.data.vehicles.filter(v=>v.customerId===c.id):[];const orders=c?activeOrders().filter(o=>o.customerId===c.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)):[];const spend=orders.reduce((n,o)=>n+o.totals.grandPaise,0),due=orders.reduce((n,o)=>n+o.duePaise,0);
 const body=`${c?`<div class="customer-metrics"><div class="customer-metric"><small>${T('customerSpend')}</small><strong>${M(spend)}</strong></div><div class="customer-metric"><small>${T('customerDue')}</small><strong>${M(due)}</strong></div><div class="customer-metric"><small>${T('invoices')}</small><strong>${orders.length}</strong></div></div>`:''}<form id="customer-form" data-id="${c?.id||''}"><div class="field-grid"><div class="field"><label>${T('name')}</label><input name="name" value="${E(c?.name||'')}" placeholder="Customer name"></div><div class="field"><label>${T('phone')}</label><input name="phone" type="tel" value="${E(c?.phone||'')}" placeholder="Contact number"></div><div class="field field-spread"><label>${T('newVehicle')}</label><input name="vehicle" placeholder="MH 21 AB 1234" value="" /><small>${c?`Current vehicles: ${E(vehicles.map(v=>v.reg).join(', ')||'none')}`:'A new vehicle can be linked here, or when creating an invoice.'}</small></div><div class="field field-spread"><label>${T('notes')}</label><textarea name="notes">${E(c?.notes||'')}</textarea></div></div></form>${c&&orders.length?`<div class="separator"></div><div class="form-section-heading"><h3>${T('customerHistory')}</h3></div><div class="detail-list">${orders.slice(0,12).map(o=>`<button class="detail-row" style="border:0;border-bottom:1px solid var(--border);background:none;width:100%;text-align:left;cursor:pointer;color:var(--ink)" data-invoice="${E(o.id)}"><span>${E(o.number)} · ${fmtDate(o.createdAt,true)}</span><strong>${M(o.totals.grandPaise)}</strong></button>`).join('')}</div>`:''}`;
 modal(c?T('customerDetails'):T('newCustomer'),c?`${E(c.name||c.phone)} · ${E(c.phone||'')}`:T('newCustomerHint'),body,modalButtons('customer-form'));}
function categoryFields(category,item,requireStockKeys=false){
 return (category?.fields||[]).map(field=>`<label class="field">${E(field.label)}<input name="attribute-${E(field.id)}" maxlength="160" ${requireStockKeys&&field.stockKey?'required':''} value="${E(item?.attributes?.[field.id]||'')}"></label>`).join('');
}
function submittedAttributes(data){
 return Object.fromEntries([...data].filter(([name])=>name.startsWith('attribute-')).map(([name,value])=>[name.slice(10),value]));
}
function categoriesPanel(){
 const others=shopCategories().filter(c=>c.id!=='tyres');
 const fields=customTyreFields(state.data.settings)?tyreFields(state.data.settings).map(f=>f.label):
   shopMode()==='detailed'?['Model','Size',...tyreFields(state.data.settings).map(f=>f.label)]:[];
 return `<section class="setting-panel">
  <h2>Tyre identification</h2>
  <p><strong>Brand</strong>${fields.length?' · '+fields.map(E).join(' · '):''}</p>
  <p>New shops select tyre-identification fields once during setup. Existing shop records retain their previous classification rules.</p>\n  ${customTyreFields(state.data.settings)?'':`<button type="button" class="button" data-action="edit-category" data-category="tyres">Manage legacy tyre fields</button>`}
  ${others.length?`<p class="small-muted">Earlier custom product categories are preserved for compatibility:</p>
   <ul class="settings-services">${others.map(c=>`<li><span>${E(c.name)}</span><button type="button" class="button small" data-action="edit-category" data-category="${E(c.id)}">Edit</button></li>`).join('')}</ul>`:''}
 </section>`;
}
function showCategoryModal(category){
 const fields=category?.fields||[];
 const tyre=category?.id==='tyres';
 const locked=tyre&&activeTyres().some(isVariantTyre);
 const input=(field,index)=>`<div class="field field-spread">
   <label>Field name<input name="field" maxlength="60" value="${E(field?.label||'')}" ${field?'required':''} placeholder="e.g. Load Index"></label>
   ${tyre?`<label class="consent"><input type="checkbox" name="stockKeyIndex" value="${index}"
      ${field?.stockKey?'checked':''} ${locked?'disabled':''}> Separate tyre variants by this field</label>`:''}
  </div>`;
 modal(tyre?'Manage tyre classification':'Edit existing category','',
 `<form id="category-form" data-id="${E(category?.id||'')}" data-locked="${locked?'yes':'no'}">
  <label class="field">Category name<input name="name" maxlength="60" required value="${E(category?.name||'')}" ${tyre?'readonly':''}></label>
  ${tyre?`<p class="small-muted">Checked fields distinguish tyre stock when purchasing and billing. Leave unchecked for notes or searchable details. Existing tyres without values remain unclassified until you assign them.</p>`:''}
  ${locked?'<p class="small-muted">Stock variant identifiers are locked after classified tyres exist. Field names may still be edited.</p>':''}
  <div class="field-grid" data-category-fields>${fields.map(input).join('')}${fields.length<12?input(null,fields.length):''}</div>
  ${fields.length<11?'<button type="button" class="button small" data-action="add-category-field">Add field</button>':''}
 </form>`,modalButtons('category-form'));
}
function customInventory(){
 const categories=shopCategories().filter(c=>c.id!=='tyres');
 if(!categories.length)return '';
 const query=state.search.trim().toLowerCase();
 return categories.map(category=>{
  const items=customProducts().filter(p=>p.categoryId===category.id&&(!query||[p.name,...Object.values(p.attributes||{})].some(value=>value.toLowerCase().includes(query))));
  return `<section class="panel"><div class="panel-header"><h3>${E(category.name)}</h3><button type="button" class="button small" data-action="edit-stock-product" data-category="${E(category.id)}">Add product</button></div>
  ${items.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Stock</th><th>Cost</th><th>Price</th><th></th></tr></thead><tbody>
  ${items.map(p=>`<tr><td><strong>${E(p.name)}</strong><span class="subtext">${category.fields.filter(f=>p.attributes?.[f.id]).map(f=>E(f.label)+': '+E(p.attributes[f.id])).join(' · ')}</span></td>
   <td>${p.stockQty||0}</td><td>${M(p.costPaise||0)}</td><td>${M(p.pricePaise)}</td><td><div class="inventory-actions">
   <button type="button" class="button small" data-stock-in="${E(p.id)}">Restock</button><button type="button" class="button small" data-action="edit-stock-product" data-product="${E(p.id)}" data-category="${E(category.id)}">Edit</button>
   <button type="button" class="button small" data-stock-adjust="${E(p.id)}">Correct stock</button></div></td></tr>`).join('')}
  </tbody></table></div>`:''}</section>`;
 }).join('');
}
function showCustomProductModal(category,product){
 if(!category)return;
 modal(product?'Edit product':'Add product',E(category.name),`<form id="custom-product-form" data-category="${E(category.id)}" data-id="${E(product?.id||'')}"><div class="field-grid">
  <label class="field field-spread">Product name<input name="name" required maxlength="150" value="${E(product?.name||'')}"></label>
  ${categoryFields(category,product)}
  ${product?'':'<label class="field">Opening stock<input name="stock" type="number" min="0" step="1" value="0" required></label>'}
  <label class="field">Cost per item (₹)<input name="cost" type="number" min="0" step="0.01" value="${amountField(product?.costPaise??0)}" required></label>
  <label class="field">Selling price (₹)<input name="price" type="number" min="0" step="0.01" value="${amountField(product?.pricePaise)}" required></label>
  ${state.data.settings.gstRegistered?`<label class="field">GST (%)<input name="gst" type="number" min="0" max="100" step="0.01" value="${(product?.taxBps||0)/100}"></label>`:''}
 </div></form>`,modalButtons('custom-product-form'));
}
function customBillPicker(){
 const groups=shopCategories().filter(c=>c.id!=='tyres').map(c=>({name:c.name,products:customProducts().filter(p=>p.categoryId===c.id&&billStock(p)>0)})).filter(group=>group.products.length);
 return groups.length?`<label class="field">Stocked products<select id="bill-product"><option value="">Choose a product</option>${groups.map(g=>`<optgroup label="${E(g.name)}">${g.products.map(p=>`<option value="${E(p.id)}">${E(p.name)} · ${M(p.pricePaise)}</option>`).join('')}</optgroup>`).join('')}</select></label>`:'';
}
function servicesSettingsPanel(){
 const services=state.data.catalog.filter(item=>item.type==='service').sort((a,b)=>a.name.localeCompare(b.name));
 return `<section class="setting-panel" aria-labelledby="settings-services-title">
 <h2 id="settings-services-title">Services</h2>
 <p>Manage the services and default prices available on invoices.</p>
 ${services.length?`<ul class="settings-services">${services.map(item=>`<li><span><strong>${E(item.name)}</strong> ·
 ${M(item.pricePaise)}${item.isActive===false?' · Hidden':''}</span>
 <button type="button" class="button small" data-edit-price="${E(item.id)}" aria-label="Edit ${E(item.name)}">Edit</button></li>`).join('')}</ul>`:''}
 <button type="button" class="button" data-action="add-price">${I('plus')}Add service</button></section>`;
}
function showPriceModal(p=null){
 const tyre=p?.type==='tyre';
 const body=`<form id="price-form" data-id="${E(p?.id||'')}" data-type="${tyre?'tyre':'service'}"><div class="field-grid">
  ${tyre?`<p class="field-spread"><strong>${E(tyreName(p,shopMode(),state.data.settings))}</strong> · Current stock ${p.stockQty||0}</p>`:`<label class="field field-spread">Service name<input name="name" maxlength="150" required value="${E(p?.name||'')}"></label>`}
  <label class="field">Selling price (₹)<input name="price" type="number" min="0" step="0.01" required value="${amountField(p?.pricePaise)}"></label>
  <label class="field">GST (%)<input name="taxRate" type="number" min="0" max="100" step="0.01" value="${p?.taxBps?p.taxBps/100:0}"></label>
  ${tyre?categoryFields(productCategory(state.data.settings,p),p):''}
  ${tyre&&stockKeyFields(state.data.settings).length&&!isVariantTyre(p)?'<p class="small-muted field-spread">This is existing unclassified tyre stock. Enter all stock-identifying fields to classify it without changing its historical ID.</p>':''}
  ${tyre&&isVariantTyre(p)?'<p class="small-muted field-spread">Stock identity is locked for this variant. To change it, create a different tyre entry and reconcile stock deliberately.</p>':''}
  ${tyre?`<label class="field">Low stock warning at<input name="lowStockAt" type="number" min="0" step="1" value="${p.lowStockAt??5}"></label>`:
    `<label class="field-spread consent"><input type="checkbox" name="activeService" ${p?.isActive===false?'':'checked'}> Show this service on new invoices</label>`}
 </div></form>`;
 modal(tyre?'Edit tyre price':p?'Edit service':'Add service','',body,modalButtons('price-form'));
}
function showStockModal(product=null,kind='purchase'){
 if(kind==='purchase'){
  if(product?.type==='product'){
   modal('Restock product',E(product.name),`<form id="custom-restock-form" data-id="${E(product.id)}" data-request="${uid()}"><div class="field-grid">
    <label class="field">Quantity<input name="qty" type="number" min="1" step="1" required></label>
    <label class="field">Cost per item (₹)<input name="cost" type="number" min="0" step="0.01" required value="${amountField(product.costPaise)}"></label>
    <label class="field field-spread">Supplier<input name="supplier" maxlength="100"></label>
   </div></form>`,modalButtons('custom-restock-form','Save purchase'));return;
  }
  const mode=shopMode();
  if(!mode){nav('settings');$('#inventory-mode-form')?.scrollIntoView({block:'center'});return;}
  const body=`<form id="purchase-form" data-product="${E(product?.id||'')}" data-request="${uid()}" data-mode="${mode}">${purchaseFields(mode,product,state.data.settings)}${!product&&!(mode==='detailed'&&customTyreFields(state.data.settings))?`<div class="field-grid">${categoryFields(shopCategories()[0],null,true)}</div>`:''}</form>`;
  modal(product?'Restock tyres':'Add purchased tyres','',body,modalButtons('purchase-form','Save purchase'),false,'purchase-dialog');
  if(!product)updatePurchaseFields($('#purchase-form'),mode,activeTyres(),'',state.data.settings);
  return;
 }
 if(!isStockProduct(product))return;
 const body=`<form id="stock-form" data-id="${E(product.id)}"><div class="field-grid">
  <label class="field">Correction<select name="direction"><option value="add">Increase stock</option><option value="remove">Decrease stock</option></select></label>
  <label class="field">Quantity<input name="qty" type="number" min="1" step="1" required value="1"></label>
  <label class="field field-spread">Reason<input name="reason" required maxlength="250" placeholder="Damage or physical count correction"></label>
 </div></form>`;
 modal('Correct stock',`${stockName(product)} · Current stock ${product.stockQty||0}`,body,modalButtons('stock-form'));
}
function appendTyre(product,qty,unitPaise){
 const used=state.bill.lines.filter(line=>line.catalogId===product.id).reduce((sum,line)=>sum+line.qty,0);
 if(!Number.isSafeInteger(qty)||qty<1||used+qty>billStock(product))throw Error('This quantity exceeds the available stock.');
 if(!Number.isSafeInteger(unitPaise)||unitPaise<0)throw Error('Enter a valid selling price.');
 state.bill.lines.push({...newLine(product),name:stockName(product),qty,unitPaise});
 rerenderBillLines();
}
function billStock(product){
 const prior=state.data.orders.find(o=>o.id===state.bill?.editing);
 return (product.stockQty||0)+(prior?.items.filter(l=>l.catalogId===product.id).reduce((sum,l)=>sum+l.qty,0)||0);
}
function updateBillPicker(changed){
 const form=$('#tyre-bill-form');
 if(form)updateTyrePicker(form,shopMode(),activeTyres().map(p=>({...p,stockQty:billStock(p)})),changed,state.data.settings);
}
function showExpenseModal(){const body=`<form id="expense-form"><div class="field-grid"><div class="field"><label>${T('amount')} (₹) *</label><input name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" autofocus></div><div class="field"><label>${T('date')}</label><input name="date" type="date" value="${todayISO()}" max="${todayISO()}"></div><div class="field"><label>${T('category')}</label><select name="category"><option>Rent</option><option>Electricity</option><option>Employee salary</option><option>Maintenance</option><option>Supplies</option><option>Transport</option><option>Other</option></select></div><div class="field"><label>${T('paymentMethod')}</label><select name="method"><option value="cash">${T('cash')}</option><option value="upi">${T('upi')}</option><option value="card">${T('card')}</option><option value="other">${T('other')}</option></select></div><div class="field field-spread"><label>${T('description')}</label><textarea name="description" placeholder="What was this expense for?"></textarea></div></div></form>`;modal(T('recordExpense'),T('expensesSubtitle'),body,modalButtons('expense-form',T('saveExpense')));}
function showPaymentModal(o){const body=`<div class="muted-note note-inline">${I('info')}<span>${E(o.number)} · ${E(o.customerSnapshot.name||'')} · ${T('due')}: <b>${M(o.duePaise)}</b></span></div><form id="payment-form" data-id="${E(o.id)}" data-confirmation="${uid()}" style="margin-top:21px"><div class="field-grid"><div class="field"><label>${T('amount')} (₹)</label><input name="amount" type="number" min="0.01" step="0.01" max="${amountField(o.duePaise)}" value="${amountField(o.duePaise)}" required></div><div class="field"><label>${T('paymentMethod')}</label><select name="method"><option value="cash">${T('cash')}</option><option value="upi">${T('upi')}</option><option value="card">${T('card')}</option><option value="other">${T('other')}</option></select></div><div class="field field-spread"><label>${T('reference')}</label><input name="reference" placeholder="Transaction reference (optional)"></div></div></form>`;modal(T('collectPayment'),'',body,modalButtons('payment-form',T('collectPayment')));}
function showRefundModal(o){const body=`<div class="muted-note note-inline">${I('alert')}<span>This only records a refund in the shop ledger. It does not transfer money through UPI, card, or a bank. Process the actual refund separately first.</span></div><form id="refund-form" data-id="${E(o.id)}" style="margin-top:18px"><div class="field-grid"><div class="field"><label>Refund amount (₹)</label><input name="amount" type="number" min="0.01" step="0.01" max="${amountField(o.paidPaise)}" value="${amountField(o.paidPaise)}" required></div><div class="field"><label>Refund method</label><select name="method"><option value="cash">${T('cash')}</option><option value="upi">UPI</option><option value="card">${T('card')}</option><option value="other">${T('other')}</option></select></div><div class="field field-spread"><label>Refund transaction reference</label><input name="reference" placeholder="Optional receipt or bank reference"></div><div class="field field-spread"><label style="display:flex;gap:9px;align-items:flex-start"><input name="confirmed" type="checkbox" required style="width:17px;height:17px;margin:0">I confirm the money has actually been refunded outside this app.</label></div></div></form>`;modal('Record refund',`${E(o.number)} · Current net paid ${M(o.paidPaise)}`,body,modalButtons('refund-form','Record verified refund'));}
function showInvoiceModal(orderId){state.modalOrderId=orderId;const o=state.data.orders.find(x=>x.id===orderId);if(!o)return toast('Invoice not found',true);const html=invoiceInner({...o,paidPaise:o.paidPaise},'80',lang());const recipient=whatsappRecipient(o.customerSnapshot?.phone);const whatsappUrl=whatsappBillUrl(o,lang());const help=recipient?T('whatsappReadyForCustomer'):T('whatsappChooseChat');const body=`<div class="invoice-preview"><div class="invoice-paper">${html}</div></div>`;const footer=`${o.status!=='cancelled'?`<button class="button primary large" data-action="show-payment-qr" data-order="${E(o.id)}">Show payment QR</button>`:''}<div class="invoice-share-group"><a class="button whatsapp large" href="${E(whatsappUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${T('shareWhatsApp')}">${I('message')}${T('shareWhatsApp')}</a><small>${help}</small></div><button class="button" data-copy-bill="${E(o.id)}">${I('file')}${T('copyWhatsAppBill')}</button><label class="invoice-format-label">${T('printFormat')} <select id="invoice-size" class="control"><option value="80">${T('thermal80')}</option><option value="58">${T('thermal58')}</option><option value="a4">A4 / PDF</option></select></label>${o.duePaise&&o.status!=='cancelled'?`<button class="button" data-pay-order="${E(o.id)}">${I('money')}${T('collectPayment')}</button>`:''}${o.paidPaise>0&&o.status!=='cancelled'?`<button class="button" data-refund-order="${E(o.id)}">Record refund</button>`:''}${o.status!=='cancelled'?`<button class="button" data-edit-invoice="${E(o.id)}">Edit items</button>`:''}${o.paidPaise===0&&o.status!=='cancelled'?`<button class="button danger" data-cancel-order="${E(o.id)}">${T('cancelInvoice')}</button>`:''}<button class="button primary" data-print-order="${E(o.id)}">${I('printer')}${T('printReceipt')}</button>`;modal(E(o.number),`${E(o.customerSnapshot?.name||'')} · ${fmtDate(o.createdAt,true)} · ${o.status==='cancelled'?'CANCELLED':o.status.toUpperCase()}`,body,footer,true);}
function triggerPrint(orderId){const o=state.data.orders.find(x=>x.id===orderId);if(!o)throw Error('Invoice not found');const size=$('#invoice-size')?.value||'80';const doc=completeInvoiceHtml({...o,paidPaise:o.paidPaise},size,lang());if(nativeAndroid()&&window.TyreDeskAndroid.printInvoiceHtml){window.TyreDeskAndroid.printInvoiceHtml(doc,size);return;}const w=window.open('','_blank');if(!w){toast('Allow pop-ups to open print preview.',true);return;}w.opener=null;w.document.open();w.document.write(doc);w.document.close();setTimeout(()=>{if(!w.closed){w.focus();w.print();}},350);}
function saveBlob(text,name,type='text/plain'){if(nativeAndroid()&&typeof window.TyreDeskAndroid.saveText==='function'){window.TyreDeskAndroid.saveText(text,name,type);return;}const b=new Blob([text],{type});const url=URL.createObjectURL(b);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),12000);}
async function backup(){const json=await exportBackup();saveBlob(nativeAndroid()?await packAndroidBackup(json):json,backupFileName(),'application/json');toast('Backup download requested. Check your Downloads or chosen folder.');}
async function backupToDrive(){const json=await exportBackup();const name=backupFileName();if(nativeAndroid()&&typeof window.TyreDeskAndroid.saveDriveBackup==='function'){window.TyreDeskAndroid.saveDriveBackup(await packAndroidBackup(json),name);return;}saveBlob(json,name,'application/json');toast('Now upload the downloaded backup file to your Google Drive.');window.open('https://drive.google.com/drive/u/0/my-drive','_blank','noopener');}
async function restoreFromDrive(){if(!nativeAndroid())toast('Download the TyreDesk JSON backup from Google Drive, then select it here.');const file=$('#restore-file');if(file){file.click();return;}await nav('settings');$('#restore-file')?.click();}
function changePinModal(){modal(T('changePassword'),T('securityNote'),`<form id="pin-form"><div class="field-grid"><div class="field field-spread"><label>Current PIN</label><input name="oldPin" type="password" pattern="[0-9]{4,12}" required inputmode="numeric"></div><div class="field"><label>New PIN</label><input name="newPin" type="password" pattern="[0-9]{4,12}" required inputmode="numeric"></div><div class="field"><label>${T('confirmPassword')}</label><input name="confirmPin" type="password" pattern="[0-9]{4,12}" required inputmode="numeric"></div></div></form>`,modalButtons('pin-form',T('saveChanges')));}
function installationInfo(){modal('Install TyreDesk',T('installHint'),`<div class="detail-list"><div class="detail-row"><span>Desktop Chrome / Edge</span><strong>Install icon in address bar</strong></div><div class="detail-row"><span>Android Chrome</span><strong>Menu → Add to Home screen / Install app</strong></div><div class="detail-row"><span>Requires initial HTTPS or localhost</span><strong>Yes</strong></div></div><div class="report-banner">A website opened directly from a file:// URL cannot register its app updates. Each device must install from a secure origin. Do not clear the browser's site data.</div>`, `<button class="button primary" data-action="close-modal">${T('continue')}</button>`);}
async function doAction(action,target){switch(action){
 case 'cloud-login':openCloudLogin();return;
 case 'account-retry':await resumeAccount();return;
 case 'account-signin':accountStep='signin';accountError='';render();return;
 case 'cloud-sync':await syncCloud();return;
 case 'cloud-logout':await logoutCloud();return;
 case 'cloud-recover':{
   if(!window.confirm('Download a backup of this device, then replace its business records with the current cloud copy? Review the backup for any unsubmitted transactions.'))return;
   if(state.data?.settings)saveBlob(await exportBackup(),backupFileName(),'application/json');
   await syncCloud(true);return;
 }
 case 'discard-invoice-edit':state.bill=null;nav('sales');return;
 case 'draft-show-qr':{
   modal('Shop payment QR',E(state.data.settings.name),draftQr(billValues()));return;
 }
 case 'draft-payment':{
   const calc=billValues();if(!calc||calc.error||!calc.due)return;
   modal('Confirm UPI receipt','Check the bank or UPI app for this transaction.',`<form id="draft-payment-form"><div class="field"><label>Amount actually received (₹)<input name="amount" type="number" min="0.01" step=".01" max="${amountField(calc.due)}" value="${amountField(calc.due)}" required></label></div><div class="field"><label>UPI reference (optional)<input name="reference" maxlength="160"></label></div><label class="consent"><input type="checkbox" name="verified" required> I verified this payment arrived.</label></form>`,modalButtons('draft-payment-form','Payment received'));return;
 }
 case 'show-payment-qr':await refresh();showPaymentQr(target.dataset.order);return;
 case 'qr-settings':closeModal();await nav('settings');$('#payment-qr-file')?.focus();return;
 case 'menu':state.menuOpen=!state.menuOpen;render();return;
 case 'close-menu':state.menuOpen=false;render();return;
 case 'close-modal':closeModal();return;

 case 'add-line':state.bill.lines.push({...newLine(),expanded:true});rerenderBillLines();return;
 case 'add-customer':showCustomerModal();return;
 case 'add-reminder':showReminderModal();return;
 case 'edit-reminder':{const item=state.data.reminders.find(r=>r.id===target.dataset.reminder);if(item)showReminderModal(item);return;}
 case 'complete-reminder':{const item=state.data.reminders.find(r=>r.id===target.dataset.reminder);if(!item)return;if(!window.confirm(T('remindersConfirmDone')))return;await completeReminder(item.id);await refresh();toast(T('remindersCompleted'));return;}
 case 'add-price':showPriceModal();return;
 case 'setup-add-service':{
   const rows=$('#setup-services-list');
   if(!rows||rows.children.length>=50)return;
   rows.insertAdjacentHTML('beforeend',serviceSetupRow());
   rows.lastElementChild.querySelector('input').focus();
   return;
 }
 case 'setup-remove-service':target.closest('.setup-service')?.remove();return;
 case 'setup-add-tyre-field':{
   const rows=$('[data-setup-tyre-rows]');
   if(!rows||rows.children.length>=12)return;
   const row=document.createElement('div');
   row.className='field field-spread setup-tyre-field';
   row.dataset.setupTyreField='';
   row.dataset.fieldId=uid();
   row.innerHTML=`<label>Field name<input name="tyreField" maxlength="60" required placeholder="e.g. Color, Code, Ply Rating"></label>
      <button type="button" class="button small" data-action="setup-remove-tyre-field">Remove field</button>`;
   rows.append(row);row.querySelector('input').focus();return;
 }
 case 'setup-remove-tyre-field':target.closest('[data-setup-tyre-field]')?.remove();return;
 
 case 'inventory-mode-settings':await nav('settings');$('#inventory-mode-form')?.scrollIntoView({block:'center'});return;
 case 'check-updates':await checkUpdates();return;
 case 'install-update':await installAppUpdate();return;
 case 'edit-category':
   if(target.dataset.category==='tyres'&&customTyreFields(state.data.settings)){toast('Tyre identifiers are fixed after business setup.');return;}
   showCategoryModal(shopCategories().find(c=>c.id===target.dataset.category));return;
 case 'add-category-field':{
   const host=$('[data-category-fields]');
   if(host.children.length<12)host.insertAdjacentHTML('beforeend',`<div class="field field-spread"><label>Field name<input name="field" maxlength="60" placeholder="e.g. Ply Rating"></label>${$('#category-form')?.dataset.id==='tyres'?`<label class="consent"><input type="checkbox" name="stockKeyIndex" value="${host.children.length}" ${$('#category-form')?.dataset.locked==='yes'?'disabled':''}> Separate tyre variants by this field</label>`:''}</div>`);
   host.lastElementChild.querySelector('input').focus();
   target.hidden=host.children.length>=12;return;
 }
 case 'edit-stock-product':showCustomProductModal(shopCategories().find(c=>c.id===target.dataset.category),customProducts().find(p=>p.id===target.dataset.product));return;
 case 'buy-tyres':showStockModal(null,'purchase');return;
 case 'export-inventory':{
   const mode=shopMode(),details=mode!=='simple'&&!customTyreFields(state.data.settings),fields=tyreFields(state.data.settings);
   const rows=activeTyres().map(p=>[p.brand||p.name,...(details?[p.model,p.size]:[]),
     ...fields.map(field=>p.attributes?.[field.id]||''),p.stockQty||0,fromPaise(p.costPaise),fromPaise(p.pricePaise)]);
   saveBlob(toCSV(['Brand',...(details?['Model','Size']:[]),...fields.map(f=>f.label),'Current stock','Cost INR','Price INR'],rows),`TyreDesk-inventory-${todayISO()}.csv`,'text/csv;charset=utf-8');return;
 }
 case 'add-expense':showExpenseModal();return;
 case 'clear-customer':delete state.bill.selectedCustomer;state.bill.selectedCustomerId=null;state.bill.customerQuery='';state.bill.customerName='';state.bill.customerPhone='';render();return;
 case 'choose-backup-folder':if(nativeAndroid()){window.TyreDeskAndroid.chooseBackupFolder();}else if(hostedPwa()){try{const status=await pwaBackups.chooseFolder();Object.assign(backupInfo,status);toast('Backup folder connected. Your first local backup will save automatically.');render();scheduleAutoBackup();}catch(e){if(e.name!=='AbortError')throw e;}}else toast('Automatic PC backups are configured by your local launcher.');return;
 case 'backup':await backup();return;
 case 'backup-options':showBackupOptions();return;
 case 'backup-settings':await nav('settings');$('#backup-settings')?.scrollIntoView({block:'start'});return;
 case 'backup-drive':await backupToDrive();return;
 case 'restore-drive':await restoreFromDrive();return;
 case 'dismiss-drive-reminder':reminderStore.setItem(driveReminderDismissKey,driveDay());closeModal();render();return;
 case 'confirm-drive-backup':
   if(!window.confirm('Confirm the backup was saved successfully to your Google Drive account?'))return;
   reminderStore.setItem(localDriveDateKey,driveDay());closeModal();render();toast('Weekly Google Drive backup marked complete.');return;
 case 'restore':{const input=$('#restore-file');if(input){input.click();}else{await nav('settings');$('#restore-file')?.click();}return;}
 case 'install':if(nativeAndroid())return;if(state.installPrompt){state.installPrompt.prompt();state.installPrompt=null;}else installationInfo();return;
 case 'change-pin':changePinModal();return;
 case 'persist-storage':if(navigator.storage?.persist){const ok=await navigator.storage.persist();toast(ok?'Persistent storage approved by browser.':'Browser did not grant persistent storage. Keep regular backups.',!ok);}else toast('Persistent storage API not supported. Keep regular backups.',true);return;
 case 'share-note':nav('sales');toast(T('openInvoiceToShare'));return;
 case 'save-bill':await saveBill();return;
 case 'export-sales':{const rows=state.data.orders.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(o=>[o.number,o.date,o.customerSnapshot.name,o.customerSnapshot.phone,o.vehicle,fromPaise(o.totals.grandPaise),fromPaise(o.paidPaise),fromPaise(o.duePaise),o.status]);saveBlob(toCSV(['Invoice','Date','Customer','Phone','Vehicle','Total INR','Paid INR','Due INR','Status'],rows),`TyreDesk-sales-${todayISO()}.csv`,'text/csv;charset=utf-8');return;}
 case 'export-customers':{const rows=state.data.customers.map(c=>[c.name,c.phone,state.data.vehicles.filter(v=>v.customerId===c.id).map(v=>v.reg).join('; '),c.notes||'']);saveBlob(toCSV(['Name','Phone','Vehicles','Notes'],rows),`TyreDesk-customers-${todayISO()}.csv`,'text/csv;charset=utf-8');return;}
 case 'export-expenses':{const rows=state.data.expenses.map(e=>[e.date,e.category,e.description,fromPaise(e.amountPaise),e.method]);saveBlob(toCSV(['Date','Category','Description','Amount INR','Method'],rows),`TyreDesk-expenses-${todayISO()}.csv`,'text/csv;charset=utf-8');return;}
 case 'export-reports':{const r=reportCalc(),rows=r.orders.map(o=>[o.number,o.date,o.customerSnapshot.name,fromPaise(o.totals.grandPaise),fromPaise(o.paidPaise),fromPaise(o.duePaise)]);saveBlob(toCSV(['Invoice','Date','Customer','Invoiced INR','Paid INR','Due INR'],rows),`TyreDesk-report-${state.reportStart}-to-${state.reportEnd}.csv`,'text/csv;charset=utf-8');return;}
 default:return;
}}
function beginInvoiceEdit(id){
 const invoice=state.data.orders.find(o=>o.id===id);
 if(!invoice||invoice.status==='cancelled')return;
 if(state.bill?.lines.length&&!window.confirm('Discard the current draft and edit this invoice?'))return;
 if(state.bill?.draftReceipts?.length)throw Error('Save the current draft with its confirmed payment before editing an invoice.');
 startBill();
 const b=state.bill,discount=invoice.orderDiscount||{type:'fixed',value:0};
 Object.assign(b,{editing:id,expectedEdit:invoice.editToken||'',selectedCustomerId:invoice.customerId,
  customerName:invoice.customerSnapshot.name,customerPhone:invoice.customerSnapshot.phone,vehicle:invoice.vehicle,
  billDiscountType:discount.type,billDiscountValue:discount.type==='percent'?String(discount.value/100):fromPaise(discount.value),
  paid:fromPaise(invoice.paidPaise),notes:invoice.notes,supplyMode:invoice.supplyMode,
  lines:invoice.items.map(l=>({...l,key:uid(),expanded:false}))});
 nav('billing');
}
async function openSavedInvoice(id){
 const details=await invoiceDetails(id);
 const previous=state.data;
 const displayed={...previous,catalog:details.catalog,
  orders:[...previous.orders.filter(order=>order.id!==id),details.order],
  payments:[...previous.payments.filter(payment=>payment.orderId!==id),...details.payments]};
 state.data=displayed;
 await nav('sales');
 showInvoiceModal(id);
 scheduleAutoBackup();
 void summaryData({dashboard:true}).then(fresh=>{
   if(state.data!==displayed||state.page!=='sales'||state.modalOrderId!==id)return;
   state.data=fresh;
 }).catch(error=>console.error('Could not refresh the sales list',error));
}
async function saveInvoiceEdit(b,calc){
 b.saving=true;$('#save-bill').disabled=true;
 try{
  await editOrder({orderId:b.editing,expectedEdit:b.expectedEdit,editToken:b.requestId,
   items:b.lines.map(({expanded,...line})=>line),discount:calc.discount,supplyMode:b.supplyMode,notes:b.notes});
  state.bill=null;await openSavedInvoice(b.editing);toast('Invoice updated.');
 }finally{b.saving=false;updateBillTotals();}
}
async function saveBill(){const b=state.bill;if(!b||b.saving)return;const calc=billValues();if(calc.error)throw Error(calc.error);if(b.editing){await saveInvoiceEdit(b,calc);return;}let name=b.customerName,phone=b.customerPhone;
 if(!b.selectedCustomerId&&!name.trim()&&!phone.trim()){throw Error('Enter a customer name or phone number, or select an existing customer.');}
 if(!b.selectedCustomerId){
  const exactPhone=phone.trim()? (await searchCustomers(phone.trim(),40)).filter(c=>normalizePhone(c.phone)===normalizePhone(phone.trim())):[];
  const exactName=name.trim()? (await searchCustomers(name.trim(),40)).filter(c=>c.name.toLowerCase()===name.trim().toLowerCase()):[];
  const duplicates=[...new Map([...exactPhone,...exactName].map(c=>[c.id,c])).values()];
  if(duplicates.length&&!window.confirm('Potential duplicate customer(s):\n'+duplicates.slice(0,6).map(c=>c.name+' / '+(c.phone||'no phone')).join('\n')+'\n\nPress Cancel to select the existing customer using search, or OK to deliberately create a separate customer.')){throw Error('Select the existing customer above, or explicitly approve a separate customer.');}
 }
 if(b.lines.some(l=>!l.name.trim()))throw Error('Every invoice line must have a description.');
 if(b.lines.some(l=>!Number.isInteger(l.qty)||l.qty<1))throw Error('Quantity must be at least 1');
 b.saving=true;const btn=$('#save-bill');if(btn)btn.disabled=true;
 try{const input={requestId:b.requestId,customerId:b.selectedCustomerId,customerName:name,customerPhone:phone,vehicle:b.vehicle,items:b.lines.map(({expanded,...line})=>line),orderDiscount:calc.discount,paidPaise:toPaise(b.paid||0),draftReceipts:b.draftReceipts||[],paymentMethod:b.method,paymentReference:b.paymentReference,notes:b.notes,supplyMode:b.supplyMode};
 let order;try{order=await completeOrder(input);}catch(err){if(err.message.includes('another customer')){const confirmed=window.confirm(T('vehicleWarning')+'\n\nTransfer this vehicle to the current customer? Previous invoices will retain their original details.');if(!confirmed)throw Error('Invoice not saved: vehicle ownership needs confirmation.');order=await completeOrder({...input,confirmVehicleTransfer:true});}else throw err;}
 const id=order.id;state.bill=null;await openSavedInvoice(id);toast(T('invoiceSaved'));
 }finally{b.saving=false;updateBillTotals();}}
async function runForm(form){const f=new FormData(form);const v=k=>String(f.get(k)||'').trim();
 if(form.id==='draft-payment-form'){
   const b=state.bill,calc=billValues(),amount=toPaise(v('amount')),ref=v('reference');
   if(!f.has('verified')||!calc||calc.error||amount<=0||amount>calc.due)throw Error('Verify the payment and enter an amount within the balance due.');
   const old=b.draftReceipts||[];if(ref&&old.some(p=>p.reference.toLowerCase()===ref.toLowerCase()))throw Error('This UPI reference is already on the draft.');
   const updated={...b,draftReceipts:[...old,{id:uid(),amountPaise:amount,reference:ref,createdAt:now()}]};
   await saveReceivedDraft(updated);state.bill=updated;closeModal();render();toast('Payment confirmed on draft. Save to generate the invoice.');return;
 }
 if(form.id==='cloud-form'){
   if(!f.has('allowSync'))throw Error('Confirm cloud sharing for this shop.');
   const initial=!state.data.settings;
   await loginCloud({username:v('username'),password:String(f.get('password')),onboarding:initial});
   if(initial){await resumeAccount();return;}
   closeModal();await refresh();toast(cloudStatus().message);return;
 }
 if(form.id==='device-pin-form'){
   const pin=v('devicePin');if(!/^\d{4,12}$/.test(pin)||pin!==v('repeatPin'))throw Error('Enter the same 4–12 digit PIN twice.');
   const pinSalt=salt();
   await restoreAccount({pinSalt,pinHash:await hashPin(pin,pinSalt)});await enterAccount();return;
 }
 if(form.id==='setup-form'){if(accountStep!=='setup')throw Error('Sign in to set up your shop.');const legalConsent=consentRecord(f.get('legalConsent')==='on');const pin=v('pin');if(!/^\d{4,12}$/.test(pin))throw Error(T('pinMin'));if(pin!==v('confirmPin'))throw Error('PINs do not match');const gst=v('gstRegistered')==='true',gstin=v('gstin').toUpperCase();if(gst&&gstin.length!==15)throw Error('A GST-registered shop needs a valid 15-character GSTIN');
 const inventoryMode=v('inventoryMode');if(!['simple','detailed'].includes(inventoryMode))throw Error('Choose an inventory mode.');
 const chosen=inventoryMode==='detailed'
   ?[...form.querySelectorAll('[data-setup-tyre-field]')].map(row=>({
       id:row.dataset.fieldId,label:row.querySelector('input[name="tyreField"]').value.trim().replace(/\s+/g,' '),stockKey:true
     })):[];
 if(inventoryMode==='detailed'&&(!chosen.length||chosen.length>12||
    chosen.some(item=>!item.label||item.label.length>60)||
    new Set(chosen.map(item=>item.label.toLocaleLowerCase())).size!==chosen.length||
    chosen.some(item=>item.label.toLowerCase()==='brand')))
   throw Error('Choose 1–12 unique tyre details, different from Brand, before creating the shop.');
 const inventoryCategories=inventoryMode==='detailed'?[{id:'tyres',name:'Tyres',fields:chosen}]:[];
 const saltHex=salt(),pinHash=await hashPin(pin,saltHex);const s={id:'shop',inventoryMode,inventoryModeLocked:true,tyreIdentitySchema:inventoryMode==='detailed'?'field-based-v1':undefined,inventoryCategories,legalConsent,name:v('name'),owner:v('owner'),phone:v('phone'),whatsapp:'',address:v('address'),city:v('city'),state:v('state'),gstin,invoicePrefix:v('invoicePrefix')||'INV',gstRegistered:gst,terms:'',language:v('language'),theme:'light',pinHash,pinSalt:saltHex,createdAt:now()};await finishFirstSetup(s,initialServices(f));await enterAccount();return;}
 if(form.id==='unlock-form'){const s=state.data.settings;if(await hashPin(v('pin'),s.pinSalt)!==s.pinHash)throw Error(T('wrongPin'));sessionStorage.setItem('tyredesk-unlocked','yes');await refresh();state.locked=false;render();updateCloudPresence();return;}
 if(form.id==='settings-form'){const s=state.data.settings;const gst=v('gstRegistered')==='true',gstin=v('gstin').toUpperCase();if(gst&&gstin.length!==15)throw Error('GST-registered businesses must enter a 15-character GSTIN');await saveSetting({...s,name:v('name'),owner:v('owner'),phone:v('phone'),whatsapp:v('whatsapp'),address:v('address'),city:v('city'),state:v('state'),invoicePrefix:v('invoicePrefix').replace(/\W/g,'').slice(0,12)||'INV',gstRegistered:gst,gstin,terms:v('terms'),paymentQrData:f.get('removeQr')?'':await encodePaymentQr(f.get('paymentQr'),s.paymentQrData||'')});await refresh();toast(T('saveChanges'));return;}
 if(form.id==='reminder-form'){const date=new Date(v('due'));if(!v('due')||!Number.isFinite(date.getTime()))throw Error(T('remindersInvalidDate'));await saveReminder({id:form.dataset.id||undefined,title:v('title'),notes:v('notes'),dueAt:date.toISOString()});await refresh();closeModal();toast(T('remindersSaved'));return;}
 if(form.id==='customer-form'){const id=form.dataset.id;let c=await upsertCustomer({id:id||undefined,name:v('name'),phone:v('phone'),notes:v('notes')});if(v('vehicle')){try{await setVehicle(v('vehicle'),c.id);}catch(err){if(err.message.includes('different customer')&&window.confirm(T('vehicleWarning')+' Transfer association?'))await setVehicle(v('vehicle'),c.id,true);else throw err;}}await refresh();closeModal();toast(T('saveChanges'));return;}
 if(form.id==='inventory-mode-form'){await setInventoryMode(v('inventoryMode'));await refresh();toast('Inventory mode saved.');return;}
 if(form.id==='tyre-bill-form'){
   const product=activeTyres().find(p=>p.id===form.dataset.product);
   if(!product)throw Error('Choose a tyre in stock.');
   appendTyre(product,Number(v('qty')),toPaise(v('price')));
   form.reset();updateBillPicker();return;
 }
 if(form.id==='category-form'){
   const selected=form.dataset.id==='tyres'
     ?(form.dataset.locked==='yes'?stockKeyFields(state.data.settings).map(key=>tyreFields(state.data.settings).findIndex(f=>f.id===key.id))
       :f.getAll('stockKeyIndex').map(Number)):undefined;
   await saveInventoryCategory(form.dataset.id,v('name'),f.getAll('field'),selected);
   await refresh();closeModal();toast('Category saved');return;
 }
 if(form.id==='custom-product-form'){
   await addCatalogItem({id:form.dataset.id||undefined,type:'product',categoryId:form.dataset.category,name:v('name'),
     openingStockQty:Number(v('stock')||0),costPaise:toPaise(v('cost')),pricePaise:toPaise(v('price')),
     taxBps:Math.round(Number(v('gst')||0)*100),attributes:submittedAttributes(f)});
   await refresh();closeModal();toast('Product saved');return;
 }
 if(form.id==='custom-restock-form'){
   await recordPurchase({productId:form.dataset.id,purchaseId:form.dataset.request,qty:Number(v('qty')),costPaise:toPaise(v('cost')),supplier:v('supplier')});
   await refresh();closeModal();toast(T('stockUpdated'));return;
 }
 if(form.id==='price-form'){
   const p=state.data.catalog.find(item=>item.id===form.dataset.id);
   await addCatalogItem({...p,name:p?.type==='tyre'?p.name:v('name'),type:form.dataset.type,
     pricePaise:toPaise(v('price')),taxBps:Math.round(Number(v('taxRate'))*100),lowStockAt:v('lowStockAt')||p?.lowStockAt,
     attributes:p?.type==='tyre'?submittedAttributes(f):undefined,
     isActive:form.dataset.type==='service'?f.has('activeService'):p?.isActive});
   await refresh();closeModal();toast(T('saveChanges'));return;
 }
 if(form.id==='purchase-form'){
   await buyTyres({mode:form.dataset.mode,existingId:form.dataset.product,purchaseId:form.dataset.request,
     brand:v('brand'),model:v('model'),size:v('size'),qty:Number(v('qty')),costPaise:toPaise(v('cost')),
     pricePaise:toPaise(v('price')),supplier:v('supplier'),reference:v('reference'),attributes:submittedAttributes(f)});
   await refresh();closeModal();toast(T('stockUpdated'));return;
 }
 if(form.id==='stock-form'){const qty=Number(v('qty'));await adjustStock(form.dataset.id,v('direction')==='remove'?-qty:qty,v('reason'));await refresh();closeModal();toast(T('stockUpdated'));return;}
 if(form.id==='expense-form'){const money=toPaise(v('amount'));await addExpense({amountPaise:money,date:v('date'),category:v('category'),description:v('description'),method:v('method')});await refresh();closeModal();toast(T('recorded'));return;}
 if(form.id==='payment-form'){if(!window.confirm('Confirm you have actually received '+M(toPaise(v('amount')))+' from the customer?'))return;const id=form.dataset.id,money=toPaise(v('amount'));await addPayment(id,money,v('method'),v('reference'),form.dataset.confirmation);await refresh();showInvoiceModal(id);toast(T('paymentRecorded'));return;}
 if(form.id==='qr-payment-form'){if(!f.get('verified'))throw Error('Verify receipt in your bank or UPI app first.');const money=toPaise(v('amount'));if(!window.confirm('Record '+M(money)+' as actually received? Displaying the QR alone is not payment.'))return;await addPayment(form.dataset.id,money,'upi',v('reference'),form.dataset.confirmation);const id=form.dataset.id;await refresh();showInvoiceModal(id);toast('Payment recorded.');return;}
 if(form.id==='refund-form'){if(!f.get('confirmed'))throw Error('Confirm that you have already refunded the payment.');const id=form.dataset.id,money=toPaise(v('amount'));await recordRefund(id,money,v('method'),v('reference'));await refresh();showInvoiceModal(id);toast('Refund recorded in the ledger.');return;}
 if(form.id==='pin-form'){const s=state.data.settings;if(await hashPin(v('oldPin'),s.pinSalt)!==s.pinHash)throw Error('Current PIN is incorrect');if(!/^\d{4,12}$/.test(v('newPin')))throw Error('Use a 4–12 digit PIN');if(v('newPin')!==v('confirmPin'))throw Error('New PINs do not match');const saltHex=salt(),pinHash=await hashPin(v('newPin'),saltHex);await saveSetting({...s,pinHash,pinSalt:saltHex});await addAudit('owner-pin-changed');await refresh();closeModal();toast(T('saveChanges'));return;}
}
document.addEventListener('click',openLegalPage);
document.addEventListener('click',async event=>{
 try{
  if(event.target.matches('[data-close-modal]')){closeModal();return;}
  const target=event.target.closest('button,[data-invoice],[data-customer]');if(!target)return;
  if(target.dataset.nav){await nav(target.dataset.nav);return;}
  if(target.dataset.action){await doAction(target.dataset.action,target);return;}
  if(target.dataset.editInvoice){beginInvoiceEdit(target.dataset.editInvoice);return;}
  if(target.dataset.invoice){showInvoiceModal(target.dataset.invoice);return;}
  if(target.dataset.customer){const c=state.data.customers.find(x=>x.id===target.dataset.customer);if(c)showCustomerModal(c);return;}
  if(target.dataset.restock){const p=activeTyres().find(x=>x.id===target.dataset.restock);if(p)showStockModal(p);return;}
  if(target.dataset.legacyTyre){const p=activeTyres().find(x=>x.id===target.dataset.legacyTyre);if(p)appendTyre(p,1,p.pricePaise);return;}
  if(target.dataset.addCatalog){const p=state.data.catalog.find(x=>x.id===target.dataset.addCatalog);if(p){state.bill.lines.push({...newLine(p),expanded:true});rerenderBillLines();}return;}
  if(target.dataset.removeLine){state.bill.lines=state.bill.lines.filter(l=>l.key!==target.dataset.removeLine);rerenderBillLines();return;}
  if(target.dataset.selectCustomer){const c=await customerDetails(target.dataset.selectCustomer);if(c&&state.bill){state.bill.selectedCustomer=c;state.bill.selectedCustomerId=c.id;state.bill.customerName=c.name;state.bill.customerPhone=c.phone;state.bill.customerQuery='';render();}return;}
  if(target.dataset.editPrice){const p=state.data.catalog.find(x=>x.id===target.dataset.editPrice);if(p)showPriceModal(p);return;}
  if(target.dataset.stockIn){showStockModal(state.data.catalog.find(x=>x.id===target.dataset.stockIn),'purchase');return;}
  if(target.dataset.stockAdjust){showStockModal(state.data.catalog.find(x=>x.id===target.dataset.stockAdjust),'adjust');return;}
  if(target.dataset.payOrder){const o=state.data.orders.find(x=>x.id===target.dataset.payOrder);if(o)showPaymentModal(o);return;}
  if(target.dataset.refundOrder){const o=state.data.orders.find(x=>x.id===target.dataset.refundOrder);if(o)showRefundModal(o);return;}
  if(target.dataset.cancelOrder){const reason=window.prompt('Cancellation reason (required):');if(!reason?.trim())return;if(!window.confirm('Cancel this unpaid invoice? This cannot be undone.'))return;await cancelOrder(target.dataset.cancelOrder,reason);await refresh();closeModal();toast('Invoice cancelled.');return;}
  if(target.dataset.printOrder){triggerPrint(target.dataset.printOrder);return;}
  if(target.dataset.copyBill){const o=state.data.orders.find(x=>x.id===target.dataset.copyBill);if(!o)throw Error('Invoice not found');await navigator.clipboard.writeText(formatWhatsAppBill(o,lang()));toast(T('whatsappCopied'));return;}
 }catch(e){errorMessage(e);}
});
document.addEventListener('submit',async event=>{const form=event.target;if(!form.id)return;event.preventDefault();if(form.dataset.busy==='yes')return;form.dataset.busy='yes';const btn=form.querySelector('button[type="submit"]')||$(`button[form="${form.id}"]`);if(btn)btn.disabled=true;try{await runForm(form);}catch(e){errorMessage(e);}finally{delete form.dataset.busy;if(btn&&btn.isConnected){if(form.id==='tyre-bill-form')btn.disabled=!form.dataset.product||Number(form.elements.qty.max)<=0;else btn.disabled=false;}}});
document.addEventListener('input',event=>{
 const target=event.target;
 const purchase=target.closest('#purchase-form');
 if(purchase&&!purchase.dataset.product){
   if(['brand','model','size'].includes(target.name)||target.name.startsWith('attribute-'))updatePurchaseFields(purchase,shopMode(),activeTyres(),target.name,state.data.settings);
   if(['cost','price'].includes(target.name))target.dataset.edited='yes';
   return;
 }
 if(target.id==='page-search'){const pos=target.selectionStart;state.search=target.value;render();const input=$('#page-search');input?.focus();try{input?.setSelectionRange(pos,pos);}catch{}return;}
 if(target.id==='customer-lookup'){state.bill.customerQuery=target.value;state.bill.selectedCustomerId=null;const q=target.value.trim();if(/^\+?[\d\s-]+$/.test(q)){state.bill.customerPhone=q;const phone=$('#bill-customer-phone');if(phone)phone.value=q;}else if(q){state.bill.customerName=q;const n=$('#bill-customer-name');if(n)n.value=q;}loadCustomerSuggestions(target.value).catch(errorMessage);return;}
 const billFields={'bill-customer-name':'customerName','bill-customer-phone':'customerPhone','bill-vehicle':'vehicle','bill-discount-value':'billDiscountValue','bill-paid':'paid','bill-reference':'paymentReference','bill-notes':'notes'};
 if(billFields[target.id]&&state.bill){state.bill[billFields[target.id]]=target.value;updateBillTotals();return;}
 if(target.dataset.lineField&&state.bill){const node=target.closest('[data-line]');const line=state.bill.lines.find(l=>l.key===node?.dataset.line);if(!line)return;const prop=target.dataset.lineField;switch(prop){case'name':line.name=target.value;break;case'qty':if(line.type!=='service')line.qty=Number(target.value);break;case'taxBps':line.taxBps=Math.round(Number(target.value)*100);break;case'unitPaise':line.unitPaise=toPaise(target.value);break;case'discountValue':line.discount.value=line.discount.type==='percent'?Math.round(Number(target.value)*100):toPaise(target.value);break;default:break;}updateBillTotals();return;}
});
document.addEventListener('change',async event=>{const el=event.target;try{
 if(el.name==='inventoryMode'&&el.closest('#setup-form')){
   const section=$('[data-setup-tyre-fields]');
   if(section)section.hidden=el.value!=='detailed';
   section?.querySelectorAll('input[name="tyreField"]').forEach(input=>{input.disabled=section.hidden;});
   return;
 }
 if(el.dataset.purchaseChoice){
   const form=el.form,key=el.dataset.purchaseChoice,input=form.elements[key];
   const manual=el.value==='__new__';
   input.value=manual?'':el.value;
   if(manual)input.dataset.manual='yes';else delete input.dataset.manual;
   updatePurchaseFields(form,shopMode(),activeTyres(),key,state.data.settings);
   if(manual)input.focus();
   return;
 }
 if(el.closest('#tyre-bill-form')&&(['brand','model','size','exact'].includes(el.name)||el.dataset.stockField)){updateBillPicker(el.dataset.stockField?'stock-field-'+el.dataset.stockField:el.name);return;}
 if(el.id==='bill-product'){
   const product=customProducts().find(item=>item.id===el.value);
   el.value='';
   if(product)appendTyre(product,1,product.pricePaise);
   return;
 }
 if(el.id==='bill-service'){
   const service=state.data.catalog.find(p=>p.id===el.value&&p.type==='service');
   if(service){state.bill.lines.push({...newLine(service),expanded:true});rerenderBillLines();}
   el.value='';return;
 }
 if(el.id==='invoice-size'){const selected=el.value;const o=state.data.orders.find(x=>x.id===state.modalOrderId);const host=$('.invoice-paper');if(o&&host)host.innerHTML=invoiceInner({...o,paidPaise:o.paidPaise},selected,lang());return;}
 if(el.id==='sales-filter'){state.salesStatus=el.value;render();return;}
 if(el.id==='report-from'||el.id==='report-to'){if(el.id==='report-from')state.reportStart=el.value;else state.reportEnd=el.value;if(state.reportStart>state.reportEnd){toast('The start date must be on or before the end date.',true);return;}render();return;}
 if(el.id==='setting-language'){await saveSetting({...state.data.settings,language:el.value});await refresh();return;}
 if(el.id==='setting-theme'){await saveSetting({...state.data.settings,theme:el.value});await refresh();return;}
 if(el.id==='bill-discount-type'){state.bill.billDiscountType=el.value;state.bill.billDiscountValue='0';const input=$('#bill-discount-value');if(input)input.value='0';updateBillTotals();return;}
 if(el.id==='bill-method'){state.bill.method=el.value;return;}
 if(el.id==='bill-supply'){state.bill.supplyMode=el.value;updateBillTotals();return;}
 if(el.dataset.lineField==='discountType'){const line=state.bill.lines.find(l=>l.key===el.closest('[data-line]').dataset.line);if(!line)return;line.discount.type=el.value;line.discount.value=0;const input=el.closest('.discount-inline').querySelector('input');if(input)input.value='0';updateBillTotals();return;}
 if(el.id==='restore-file'){if(!el.files?.length)return;const file=el.files[0];if(file.size>100_000_000)throw Error('Backup file is larger than 100 MB');const backupText=await file.text();if(!window.confirm(T('restoreWarning')+'\n\nThis will replace this device’s records and disconnect it from cloud sync. The shared cloud copy is kept. Back up the current device first. Continue?')){el.value='';return;}const counts=await restoreOffline(()=>restoreBackup(backupText,{disconnectCloud:true}));sessionStorage.removeItem('tyredesk-unlocked');state.locked=true;state.bill=null;await refresh();toast(T('restoreSuccess')+' · '+counts.orders+' invoices.');return;}
 }catch(err){errorMessage(err);}});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(state.modal)closeModal();else if(state.menuOpen){state.menuOpen=false;render();}}if(e.ctrlKey&&e.key.toLowerCase()==='k'&&!state.locked){e.preventDefault();nav('billing');}});
// A natural left swipe on the open drawer closes it; vertical scrolling remains untouched.
let menuSwipeStart=null;
document.addEventListener('touchstart',event=>{
 if(!state.menuOpen||!event.target.closest('#app-sidebar')||event.touches.length!==1)return;
 const touch=event.touches[0];menuSwipeStart={x:touch.clientX,y:touch.clientY};
},{passive:true});
document.addEventListener('touchend',event=>{
 if(!menuSwipeStart)return;
 const start=menuSwipeStart;menuSwipeStart=null;
 const touch=event.changedTouches[0];if(!touch||!state.menuOpen)return;
 const dx=touch.clientX-start.x,dy=touch.clientY-start.y;
 if(dx < -80&&Math.abs(dx)>Math.abs(dy)*1.5){state.menuOpen=false;render();}
},{passive:true});

// Keep every mobile dialog inside Android's *visible* viewport when the
// keyboard opens. Never scroll the document behind a dialog to focus an input.
if(window.visualViewport){
 let fullHeight=window.visualViewport.height;
 const viewport=window.visualViewport;
 const scrollFocusedInput=()=>{
  if(document.documentElement.classList.contains('tyredesk-native-form-page'))return; // Android handles document scrolling.
  const target=document.activeElement;
  if(!target?.matches?.('input,textarea,select')||!target.isConnected)return;
  const region=target.closest('.modal-body');
  if(region){
   const bounds=region.getBoundingClientRect(),field=target.getBoundingClientRect();
   if(field.bottom>bounds.bottom-12)region.scrollTop+=field.bottom-bounds.bottom+12;
   else if(field.top<bounds.top+12)region.scrollTop+=field.top-bounds.top-12;
  }
 };
 const viewportChanged=()=>{
  const focused=document.activeElement;
  const typing=focused?.matches?.('input:not([type="checkbox"]):not([type="radio"]),textarea,select');
  if(!typing)fullHeight=Math.max(fullHeight,viewport.height);
  const keyboardOpen=!!typing&&fullHeight-viewport.height>130;
  document.documentElement.classList.toggle('keyboard-open',keyboardOpen);
  document.documentElement.style.setProperty('--visible-screen-height',Math.round(viewport.height)+'px');
  document.documentElement.style.setProperty('--visible-screen-top',Math.round(viewport.offsetTop)+'px');
  if(typing&&focused?.closest('.modal-body'))requestAnimationFrame(scrollFocusedInput);
 };
 viewport.addEventListener('resize',viewportChanged);
 viewport.addEventListener('scroll',viewportChanged);
 document.addEventListener('focusin',event=>{
  if(!event.target.matches('input,textarea,select'))return;
  fullHeight=Math.max(fullHeight,viewport.height);
  requestAnimationFrame(()=>{viewportChanged();scrollFocusedInput();});
  setTimeout(()=>{viewportChanged();scrollFocusedInput();},240);
 });
 document.addEventListener('focusout',()=>setTimeout(viewportChanged,240));
 viewportChanged();
}
window.setInterval(tickReminderIndicator,60*1000);
window.addEventListener('focus',tickReminderIndicator);
document.addEventListener('visibilitychange',tickReminderIndicator);
const shopIsUnlocked=()=>!!state.data?.settings&&!state.locked;
init().then(async()=>{if(state.data?.settings)startCloud(shopIsUnlocked);else if(state.data)await resumeAccount();});
// Avoid rebuilding form inputs during typing. Update only the live total pane after route/render.
// The route itself invokes this after its content is inserted.
const observer=new MutationObserver(()=>{
 for(const table of document.querySelectorAll('.page .data-table:not([data-mobile-labeled])')){
  table.dataset.mobileLabeled='yes';
  const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
  for(const row of table.tBodies[0]?.rows||[]){
   if(row.cells.length===headers.length)for(const [index,cell] of [...row.cells].entries())cell.dataset.label=headers[index];
  }
 }
 if(state.page==='billing'&&!state.locked&&$('#bill-summary-dynamic')&&!$('#bill-summary-dynamic').dataset.ready){$('#bill-summary-dynamic').dataset.ready='1';updateBillTotals();updateBillPicker();}});
observer.observe(document.getElementById('app'),{childList:true,subtree:true});
async function encodePaymentQr(file,previous=''){
 if(!(file instanceof File)||!file.size)return previous;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5_000_000)throw Error('Use a PNG, JPG or WebP QR image smaller than 5 MB.');
 return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{try{if(!img.width||!img.height||img.width*img.height>32_000_000)throw Error('QR image dimensions are too large.');const scale=Math.min(1,1600/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/png'));}catch(e){reject(e);}finally{URL.revokeObjectURL(url);}};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Could not read QR image.'));};img.src=url;});
}
function showPaymentQr(id){
 const o=state.data.orders.find(o=>o.id===id);if(!o||o.status==='cancelled')throw Error('Invoice is unavailable.');
 if(!state.data.settings.paymentQrData){modal('Add your shop payment QR','No payment has been recorded.',`<p>Upload your shop’s own UPI QR image in Settings, then reopen this bill to show it to the customer.</p>`,`<button class="button primary" data-action="qr-settings">Add QR in Settings</button>`);return;}
 const body=`<div class="payment-qr-display"><h3>${E(state.data.settings.name)}</h3><p>${E(o.number)}</p><strong class="qr-due">Amount due: ${M(o.duePaise)}</strong><img src="${E(state.data.settings.paymentQrData)}" alt="Shop payment QR for customer scanning"><p>Ask the customer to enter the amount due and check the recipient. This image does not set the amount or verify payment.</p></div>${o.duePaise>0?`<form id="qr-payment-form" data-id="${E(id)}" data-confirmation="${E(qrConfirmation(id))}"><div class="field"><label>Amount actually received (₹)</label><input name="amount" type="number" step="0.01" min="0.01" max="${amountField(o.duePaise)}" value="${amountField(o.duePaise)}" required></div><div class="field"><label>Transaction reference (optional)</label><input name="reference" maxlength="160"></div><label class="consent"><input type="checkbox" name="verified" required> I verified the money arrived in my bank or UPI app.</label><p>Partial payments reduce the balance. Showing this QR records nothing.</p></form>`:'<p class="report-banner">This bill is fully paid. No further payment confirmation is available.</p>'}`;
 modal('Show payment QR','Verify receipt before recording payment.',body,o.duePaise>0?modalButtons('qr-payment-form','Payment received'):`<button class="button" data-action="close-modal">Close</button>`);
}
function qrConfirmation(id){
 const latest=state.data.payments.filter(p=>p.orderId===id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id))[0];
 // Use the balance the owner actually saw. Two devices confirming that balance share a receipt.
 return 'qr-'+id+'-'+(latest?.createdAt||'initial')+'-'+(latest?.amountPaise||0);
}
const canBill=()=>[null,'active'].includes(cloudStatus().billingAccess);
function billingPanelContent(){
 const {billingAccess:access}=cloudStatus();
 if(!access)return '';
 const message={
  active:'',
  switching:'Syncing saved work before switching billing devices.',
  busy:'Billing is open on another device. Close TyreDesk there while it’s online. If that device is lost, ask the shop administrator to retire it before billing here.',
  claiming:'Connecting to the shop to open billing.',
  restoring:'Syncing recovered records before opening billing.',
  retired:'This device was retired. Export any unsynced records for review.',
  disconnected:'Sign in to the shop to use this backup for billing.',
  view:'Billing opens automatically when this device is online and access is available.',
 }[access];
 return message?`<p role="status">${message}</p>${access==='disconnected'?'<button type="button" class="button" data-action="cloud-login">Shop sign-in</button>':''}`:'';
}
function billingPanel(){const content=billingPanelContent();return `<section class="billing-access" data-billing-access ${content?'':'hidden'}>${content}</section>`;}
function cloudPanel(){const status=cloudStatus();return `<section class="setting-panel"><h2>Shop cloud sync</h2>${billingPanel()}<p data-cloud-status role="status">${E(status.message)}</p><p data-storage-warning role="status">${storageWarning(status.databaseBytes)}</p><button class="button primary" data-action="cloud-login">Shop sign-in</button> <button class="button" data-action="cloud-sync">Sync now</button> <button class="button" data-action="cloud-logout">Sign out on this device</button><p><a href="${E(status.dashboard)}" target="_blank" rel="noopener">Open shop project dashboard</a></p><button class="button" data-action="cloud-recover" ${status.blocked?'':'hidden'}>Back up this device and use cloud copy</button></section>`;}
async function enterAccount(){
 sessionStorage.setItem('tyredesk-unlocked','yes');state.locked=false;accountError='';await refresh();startCloud(shopIsUnlocked);
}
async function resumeAccount(){
 accountStep='checking';accountError='';render();
 try{
   accountStep=await firstRunStep();
   if(accountStep==='ready'){await enterAccount();return;}
 }catch(e){accountStep='retry';accountError=e.message;}
 render();
}
function renderAccountEntry(){
 if(accountStep==='checking')return setupFrame('<div class="setup-form"><h2>Checking your shop…</h2></div>');
 if(accountStep==='retry')return setupFrame(`<div class="setup-form"><h2>Couldn’t check your shop</h2><p role="alert">${E(accountError)}</p><button class="button primary" data-action="account-retry">Try again</button> <button class="button" data-action="account-signin">Sign in again</button></div>`);
 if(accountStep==='pin')return setupFrame('<form class="setup-form" id="device-pin-form"><h2>Choose a PIN for this device</h2><p>Your shop was found. Use this PIN to open TyreDesk on this device.</p><div class="field"><label>Device PIN<input type="password" name="devicePin" pattern="[0-9]{4,12}" inputmode="numeric" autocomplete="new-password" required></label></div><div class="field"><label>Repeat PIN<input type="password" name="repeatPin" pattern="[0-9]{4,12}" inputmode="numeric" autocomplete="new-password" required></label></div><button class="button primary large" type="submit">Open my shop</button></form>');
 return setupFrame(`<div class="setup-form"><h2>Sign in to your shop</h2><p>Use your TyreDesk login to open your business on this device.</p>${cloudLoginForm()}<button type="button" class="button" data-action="restore">Restore a backup file</button><input id="restore-file" type="file" accept=".json,application/json" hidden></div>`);
}
function cloudLoginForm(){return `<form id="cloud-form"><div class="field"><label>Shop username<input name="username" required autocomplete="username" autocapitalize="none"></label></div><div class="field"><label>Shop password<input name="password" type="password" required autocomplete="current-password"></label></div><label class="consent"><input type="checkbox" name="allowSync" required> I authorise syncing this shop’s billing, customer, inventory, reminder and QR records to its own Supabase project. I have read the ${legalLinks()}.</label><button type="submit" class="button primary large">Sign in</button></form>`;}
function openCloudLogin(){modal('Shop sign-in','Use the same shop login on Windows and Android.',cloudLoginForm());}
window.addEventListener('tyredesk-cloud-status',()=>{
 const s=cloudStatus();document.querySelectorAll('[data-cloud-status]').forEach(el=>el.textContent=s.message);
 const editorWasHidden=$('.bill-layout[data-billing-editor]')?.hidden;
 const billing=billingPanelContent();
 document.querySelectorAll('[data-billing-access]').forEach(el=>{
   if(el.billingContent!==billing){el.innerHTML=billing;el.billingContent=billing;}
   el.hidden=!billing;
 });
 document.querySelectorAll('[data-billing-editor]').forEach(el=>el.hidden=!canBill());
 if(s.billingAccess==='active'&&editorWasHidden&&!state.locked)void refresh();
 const usage=$('[data-storage-warning]');if(usage)usage.textContent=storageWarning(s.databaseBytes);
 const recover=document.querySelector('[data-action="cloud-recover"]');if(recover)recover.hidden=!s.blocked;
});
window.addEventListener('tyredesk-cloud-data',async()=>{
 const page=state.page;
 const fresh=await summaryData({dashboard:!needsFullHistory(page)});if(state.page!==page)return;state.data=fresh;
 // Keep the current bill, form, and payment confirmation on screen while the owner is typing.
 if(!state.modal&&!document.activeElement?.matches('input,textarea,select')&&state.page!=='billing')render();
 scheduleAutoBackup();
});

function draftQr(calc){
 const qr=state.data.settings.paymentQrData;
 const confirmed=(state.bill.draftReceipts||[]).reduce((n,p)=>n+p.amountPaise,0);
 const note=confirmed?`<p><strong>UPI received on this draft · ${M(confirmed)}</strong><br>Save to generate the invoice.</p>`:'';
 const hasTotal=!!calc?.calculated&&calc.calculated.totals.grandPaise>0;
 const settled=hasTotal&&calc.due===0;
 if(!qr)return note+'<p>Upload your shop’s payment QR to show it here.</p><button type="button" class="button" data-action="qr-settings">Add QR in Settings</button>';
 const due=hasTotal&&calc.due>0?M(calc.due):'';
 const title=due?'Scan to pay '+due:'Shop payment QR';
 return note+`<section class="payment-qr-display draft-qr" aria-label="Scan to pay"><h3>${title}</h3><img src="${E(qr)}" alt="Shop payment QR"><p>${due?'Enter '+due+' in your UPI app.':settled?'This bill has no remaining balance.':'Add a priced item to calculate the amount due.'}</p>${due?'<button type="button" class="button" data-action="draft-payment">Payment received</button>':''}</section>`;
}

function androidUpdateNote(){
 return nativeAndroid()?`<p class="small-muted update-android-note">TyreDesk updates are digitally signed and downloaded from the TyreDesk site. Android may check the APK with Google Play Protect.</p>`:'';
}
function updateActions(){
 const update=updateStatus();
 const busy=['checking','installing'].includes(update.phase);
 return `<p role="status">${E(update.message)}</p><button type="button" class="button" data-action="check-updates" ${busy?'disabled':''}>Check for updates</button>
 ${nativeAndroid()?'<button type="button" class="button primary" data-action="install-update">Open Download Page</button>'+androidUpdateNote():['available','retry'].includes(update.phase)?'<button type="button" class="button primary" data-action="install-update">Update Now</button>':''}`;
}
function updatePanel(){
 return `<section class="setting-panel"><h2>Update App</h2><div data-update-settings>${updateActions()}</div></section>`;
}
function updateBanner(){
 const update=updateStatus();
 if(!['available','installing'].includes(update.phase))return '';
 return `<section class="report-banner update-banner"><div><strong>Update Available</strong><p role="status">${E(update.message)}</p>${update.phase==='installing'?'':androidUpdateNote()}</div>
 ${update.phase==='installing'?'':'<button type="button" class="button primary" data-action="install-update">'+(nativeAndroid()?'Open Download Page':'Update Now')+'</button>'}</section>`;
}
window.addEventListener('tyredesk-update',()=>{
 const settings=$('[data-update-settings]'),banner=$('[data-update-banner]');
 if(settings)settings.innerHTML=updateActions();
 if(banner)banner.innerHTML=updateBanner();
});
initUpdates();

function storageWarning(bytes){
 if(!Number.isFinite(bytes)||bytes<367001600)return '';
 const percent=Math.floor(bytes/524288000*100);
 return percent>=85?`Database is ${percent}% full. Ask the shop administrator to review usage or plan an upgrade.`:
   `Database is ${percent}% full. Ask the shop administrator to check usage.`;
}
