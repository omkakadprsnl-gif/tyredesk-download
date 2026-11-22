/**
 * User-approved, external, automatic backups for the website-installed Windows PWA.
 * No server, cloud account, or filesystem access without a user's initial selection.
 * Files live in the selected directory's "TyreDesk Backups" subfolder and survive
 * clearing the web app's IndexedDB (provided the user hasn't deleted the files).
 */
export const PWA_BACKUP_DB = 'tyredesk-pwa-backup-preferences-v1';
const STORE = 'preferences';
const NAME = /^TyreDesk-auto-(\d{4}-\d{2}-\d{2})\.json$/;
const MODE = {mode:'readwrite'};
const textEncoder = new TextEncoder();

export function dateStamp(date=new Date()) {
  const year=date.getFullYear();
  return `${year}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function olderBackupNames(names, retention=14) {
  const retained=[...names].filter(name=>NAME.test(name)).sort();
  const recent = new Set(retained.slice(-Math.max(2,retention)));
  const months = new Set();
  return retained.slice().reverse().filter(name=>{
    const month=NAME.exec(name)[1].slice(0,7);
    const keep=recent.has(name)||(!months.has(month)&&months.size<6);
    months.add(month);
    return !keep;
  });
}

/** Browser IndexedDB can persist a FileSystemDirectoryHandle as a structured clone. */
export function createBackupPreferenceStore(idb=globalThis.indexedDB){
  let database;
  async function open(){
    if(database)return database;
    if(!idb)throw Error('Browser storage is unavailable. Use Chrome or Edge with storage enabled.');
    database=await new Promise((resolve,reject)=>{
      const r=idb.open(PWA_BACKUP_DB,1);
      r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE);};
      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(r.error||Error('Cannot save backup folder settings.'));
    });
    return database;
  }
  async function op(key,value,write){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,write?'readwrite':'readonly');
      const r=write?tx.objectStore(STORE).put(value,key):tx.objectStore(STORE).get(key);
      r.onsuccess=()=>{if(!write)resolve(r.result);};
      tx.oncomplete=()=>{if(write)resolve(true);};
      r.onerror=()=>reject(r.error||Error('Backup preference operation failed'));
      tx.onerror=()=>reject(tx.error||Error('Backup preference transaction failed'));
      tx.onabort=()=>reject(tx.error||Error('Backup preference transaction aborted'));
    });
  }
  return {get:key=>op(key,null,false),set:(key,value)=>op(key,value,true)};
}

export async function verifyTyreDeskBackup(json, subtle=globalThis.crypto?.subtle){
  if(typeof json!=='string'||json.length>100_000_000)throw Error('Backup is missing or too large.');
  let parsed;try{parsed=JSON.parse(json);}catch{throw Error('Invalid backup JSON.');}
  if(parsed?.payload?.app!=='TyreDesk'||typeof parsed.checksum!=='string'||!Array.isArray(parsed?.payload?.data?.settings))throw Error('Not a valid TyreDesk backup.');
  if(!subtle)throw Error('Secure browser storage is required for verified backups.');
  const hash=await subtle.digest('SHA-256',textEncoder.encode(JSON.stringify(parsed.payload)));
  const hex=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(hex!==parsed.checksum)throw Error('Backup checksum failed. No file was written.');
  return parsed;
}

export function createPwaBackupManager({
  store=createBackupPreferenceStore(),
  picker=options=>globalThis.showDirectoryPicker(options),
  supportsPicker=()=>typeof globalThis.showDirectoryPicker==='function',
  currentDate=()=>new Date(),
  subtle=globalThis.crypto?.subtle,
  retentionDays=14
}={}){
  let loaded=false,folderHandle=null,lastSaved=null,lastFolderName='',lastError='';
  async function load(){
    if(loaded)return;
    folderHandle=(await store.get('folder'))||null;
    lastSaved=(await store.get('lastSaved'))||null;
    lastFolderName=(await store.get('folderName'))||folderHandle?.name||'';
    loaded=true;
  }
  function displayFolder(){return lastFolderName==='TyreDesk Backups'?lastFolderName:`${lastFolderName} / TyreDesk Backups`;}
  async function permission(){
    if(!folderHandle)return 'not-configured';
    if(typeof folderHandle.queryPermission!=='function')return 'unavailable';
    return folderHandle.queryPermission(MODE);
  }
  async function getStatus(){
    if(!supportsPicker())return {enabled:false,lastSaved:null,folder:'',error:'Folder backups need Chrome or Edge on HTTPS.',needsPermission:false};
    try{
      await load();
      const p=await permission();
      return {enabled:p==='granted',lastSaved,folder:folderHandle?displayFolder():'',needsPermission:p!=='granted'&&!!folderHandle,error:lastError||((p==='prompt'||p==='denied')?'Backup folder needs permission again. Tap Reconnect Backup Folder.':(p==='unavailable'?'Folder permissions not supported.':''))};
    }catch(error){return {enabled:false,lastSaved,folder:lastFolderName,error:'Cannot access backup folder: '+error.message,needsPermission:!!folderHandle};}
  }
  async function chooseFolder(){
    if(!supportsPicker())throw Error('Automatic folder backups require desktop Chrome or Edge over HTTPS.');
    await load();
    // The permission request must happen directly in this click handler (user gesture).
    if(folderHandle&&typeof folderHandle.requestPermission==='function'){
      try{
        if(await folderHandle.requestPermission(MODE)==='granted'){
          lastError='';return getStatus();
        }
      }catch{ /* User may choose a new folder instead. */ }
    }
    const selected=await picker({id:'tyredesk-local-backups',mode:'readwrite',startIn:'documents'});
    if(!selected||selected.kind!=='directory')throw Error('Choose a folder to save backups.');
    if(typeof selected.queryPermission==='function'&&await selected.queryPermission(MODE)!=='granted'){
      if(typeof selected.requestPermission!=='function'||await selected.requestPermission(MODE)!=='granted')throw Error('Folder write permission was not granted.');
    }
    await store.set('folder',selected);
    await store.set('folderName',selected.name);
    await store.set('lastSaved',null);
    folderHandle=selected;lastFolderName=selected.name;lastSaved=null;lastError='';
    return getStatus();
  }
  async function targetDirectory(){
    if(!folderHandle)throw Error('Choose a backup folder first.');
    const p=await permission();
    if(p!=='granted')throw Error('Backup folder access expired. Tap Reconnect Backup Folder.');
    return folderHandle.name==='TyreDesk Backups'?folderHandle:folderHandle.getDirectoryHandle('TyreDesk Backups',{create:true});
  }
  async function saveBackup(json){
    await load();
    // Validate before touching files or deleting old copies.
    const parsed=await verifyTyreDeskBackup(json,subtle);
    const shop=parsed.payload.data.settings[0];
    if(!shop?.createdAt)throw Error('Backup is missing the shop identity.');
    const key=await subtle.digest('SHA-256',textEncoder.encode(shop.createdAt));
    const directory='Shop-'+[...new Uint8Array(key)].slice(0,12).map(x=>x.toString(16).padStart(2,'0')).join('');
    try{
      const root=await targetDirectory();
      const dir=await root.getDirectoryHandle(directory,{create:true});
      const name=`TyreDesk-auto-${dateStamp(currentDate())}.json`;
      const handle=await dir.getFileHandle(name,{create:true});
      const writer=await handle.createWritable();
      try{await writer.write(json);await writer.close();}
      catch(err){try{await writer.abort?.();}catch{}throw err;}
      // A write is successful only after reading back the complete data.
      const saved=await (await handle.getFile()).text();
      if(saved!==json)throw Error('Backup verification failed after writing the file.');
      const month=dateStamp(currentDate()).slice(0,7);
      const rotationKey='rotation:'+directory;
      if (await store.get(rotationKey)!==month){
        const names=[];
        for await(const [candidate,entry] of dir.entries())if(entry.kind==='file'&&NAME.test(candidate))names.push(candidate);
        const recent=names.filter(candidate=>candidate!==name).sort().at(-1);
        if(recent){
          let priorValid=false;
          try{
            const prior=await dir.getFileHandle(recent);
            await verifyTyreDeskBackup(await (await prior.getFile()).text(),subtle);priorValid=true;
          }catch{}
          if(priorValid){
            for(const old of olderBackupNames(names,retentionDays))if(old!==name&&old!==recent)await dir.removeEntry(old);
            await store.set(rotationKey,month);
          }
        }
      }
      lastSaved=currentDate().toISOString();lastError='';
      await store.set('lastSaved',lastSaved);
      return {enabled:true,lastSaved,folder:displayFolder(),error:'',needsPermission:false};
    }catch(error){lastError=error.message;throw error;}
  }
  return {getStatus,chooseFolder,saveBackup};
}
