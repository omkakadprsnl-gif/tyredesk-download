export const WEB_VERSION='1.3.4';

function newerVersion(candidate,current){
  if(!/^\d+\.\d+\.\d+$/.test(candidate))return false;
  const comparison=candidate.split('.').map((n,i)=>Number(n)-Number(current.split('.')[i]));
  return (comparison.find(n=>n!==0)||0)>0;
}

let state={phase:'unknown',message:'Check for a newer version.'};
let inFlight;
export const updateStatus=()=>state;
function publish(phase,message){
  state={phase,message};
  window.dispatchEvent(new Event('tyredesk-update'));
}

export function initUpdates(){
  window.addEventListener('tyredesk-native-update',event=>{
    if(event.detail?.message)publish(event.detail.phase,event.detail.message);
  });
  window.addEventListener('online',checkUpdates);
  window.addEventListener('pageshow',checkUpdates);
  const checkWhileOpen=()=>{
    if(document.visibilityState==='visible')void checkUpdates();
  };
  window.addEventListener('focus',checkWhileOpen);
  document.addEventListener('visibilitychange',checkWhileOpen);
  setInterval(checkWhileOpen,5*60*1000);
  void checkUpdates();
}

export function checkUpdates(){
  if(inFlight)return inFlight;
  const android=window.TyreDeskAndroid;
  if(android?.checkForUpdate){android.checkForUpdate();return Promise.resolve();}
  if(android){publish('error','Install the signed update from the TyreDesk download page over your existing app.');return Promise.resolve();}
  if(state.phase!=='available')publish('checking','Checking for updates…');
  inFlight=(async()=>{
    const target=new URL('../release.json',location.href);
    const response=await fetch(target,{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('Release info is unavailable.');
    const data=await response.json();
    const registration=await navigator.serviceWorker?.getRegistration();
    await registration?.update();
    if(newerVersion(data.webVersion||data.version,WEB_VERSION))publish('available','A newer version of the web app is available.');
    else publish('current','You’re using the latest version.');
  })().catch(()=>{
    if(state.phase!=='available')publish('error','Couldn’t check for updates. Check your connection and try again.');
  }).finally(()=>{inFlight=null;});
  return inFlight;
}

export async function installAppUpdate(){
  if(window.TyreDeskAndroid?.installUpdate){window.TyreDeskAndroid.installUpdate();return;}
  const worker=await navigator.serviceWorker?.getRegistration();
  await worker?.update();
  const installing=worker?.installing||worker?.waiting;
  if(installing&&installing.state!=='activated'){
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('The web update is still downloading. Try again shortly.')),15000);
      const done=()=>{
        if(installing.state==='activated'){clearTimeout(timeout);resolve();}
        if(installing.state==='redundant'){clearTimeout(timeout);reject(Error('The web update did not finish. Try again.'));}
      };
      installing.addEventListener('statechange',done);
      done();
    });
  }
  location.reload();
}

