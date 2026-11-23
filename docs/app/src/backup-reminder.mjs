// In-app weekly Google Drive reminder. Uses the device's local Monday, not UTC.
export function mondayBackupDue({now=new Date(),dateKey='',lastSaved='',dismissedDate='',shopReady=false}={}){
  if(!shopReady||now.getDay()!==1)return false;
  const monday=dateKey||[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  return !String(lastSaved||'').startsWith(monday)&&dismissedDate!==monday;
}
