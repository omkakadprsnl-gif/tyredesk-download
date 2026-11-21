import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import 'fake-indexeddb/auto';
import { getDatabase, getSetting, saveSetting, saveReminder, completeReminder, all, exportBackup, restoreBackup, summaryData } from '../docs/app/src/db.mjs';
import { translations } from '../docs/app/src/i18n.mjs';
globalThis.crypto ??= webcrypto;

await getDatabase();
await saveSetting({id:'shop',name:'Test Tyre Shop'});
const dueAt=new Date(Date.now()+86_400_000).toISOString();
const first=await saveReminder({title:'Contact supplier',notes:'Ask about size 185/65 R15',dueAt});
assert.equal(first.title,'Contact supplier');
assert.equal((await all('reminders')).length,1,'Reminder must persist in local IndexedDB');
assert.equal((await summaryData()).reminders.length,1,'Reminder must appear in dashboard data');
const edited=await saveReminder({id:first.id,title:'Contact tyre supplier',notes:'Ask about delivery',dueAt});
assert.equal(edited.id,first.id,'Editing must not duplicate records');
assert.equal((await all('reminders')).length,1);
let invalidRejected=false;
try{await saveReminder({title:'Invalid time',dueAt:'bad-date'});}catch{invalidRejected=true;}
assert.equal(invalidRejected,true,'Invalid dates must be rejected');
const snapshot=await exportBackup();
const record=JSON.parse(snapshot);
assert.equal(record.payload.schemaVersion,6);
assert.equal(record.payload.data.reminders.length,1,'Pending reminders must be backed up');

await completeReminder(edited.id);
assert.equal((await all('reminders')).length,0,'Completed reminders must be deleted, not archived');
const afterComplete=JSON.parse(await exportBackup());
assert.equal(afterComplete.payload.data.reminders.length,0,'Completed reminders must not appear in backups');
await restoreBackup(snapshot);
assert.equal((await all('reminders')).length,1,'Pending reminders must survive backup restore');
await completeReminder(edited.id);

// Simulate a valid legacy v5 backup (before reminders existed).
const legacy=JSON.parse(snapshot);
legacy.payload.schemaVersion=5;
delete legacy.payload.data.reminders;
const data=new TextEncoder().encode(JSON.stringify(legacy.payload));
legacy.checksum=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join('');
await restoreBackup(JSON.stringify(legacy));
assert.equal((await all('reminders')).length,0,'Legacy backup must restore with empty reminders');
assert.equal((await getSetting()).name,'Test Tyre Shop');

for(const code of ['en','hi','mr']){
 assert.ok(translations[code].reminders,'Reminder label must be translated');
 assert.ok(translations[code].remindersConfirmDone,'Completion warning must be translated');
}

console.log('Reminder database, editing, completion, backup, legacy restore and translations: PASS');
