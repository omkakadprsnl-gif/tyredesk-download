import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const css=await fs.readFile(new URL('../docs/app/styles.css',import.meta.url),'utf8');
const main=await fs.readFile(new URL('../docs/app/src/main.mjs',import.meta.url),'utf8');
const begin=main.indexOf('let nativeFormReturnY=0;');
const end=main.indexOf('\nfunction showBackupOptions()',begin);
assert.ok(begin>0&&end>begin,'Native form-page functions must be present');
const source=main.slice(begin,end);
assert.ok(source.includes('tyredesk-native-form-page'));
assert.ok(main.includes("if(document.documentElement.classList.contains('tyredesk-native-form-page'))return;"),'Custom scrolling must not interfere with page scrolling');
assert.match(css,/html\.tyredesk-native-form-page \.overlay[^\n]*\.modal-body|html\.tyredesk-native-form-page \.overlay \.modal-body/);

const browser=await chromium.launch();
try{
 for(const width of [320,360,390]){
  const context=await browser.newContext({viewport:{width,height:760},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage();
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>${css.replaceAll('</style>','')}</style></head><body>
  <div id="app"><div class="shell"><main class="main"><div class="page"><h1>New invoice</h1><input id="invoice-input"></div></main></div>
  <div id="modal-host"></div></div></body></html>`);
  await page.addScriptTag({content:`
    const state={modal:null};
    const $=selector=>document.querySelector(selector);
    const nativeAndroid=()=>true;
    const I=()=>'';const E=value=>String(value);
    ${source}
    window.openFormPage=(formId)=>{
     const rows=Array.from({length:12},(_,i)=>'<div class="field"><label>Field '+i+'</label><input name="field'+i+'" placeholder="Entry '+i+'"></div>').join('');
     modal(formId,'','<form id="'+formId+'">'+rows+'</form>','<button class="button" data-action="close-modal">Cancel</button><button class="button primary" form="'+formId+'">Save</button>',false,formId==='purchase-form'?'purchase-dialog':'');
    };
    window.closeFormPage=closeModal;
  `});
  for(const formId of ['purchase-form','reminder-form','expense-form']){
   await page.evaluate(id=>window.openFormPage(id),formId);
   await page.waitForTimeout(30);
   const before=await page.evaluate(()=>({
      classEnabled:document.documentElement.classList.contains('tyredesk-native-form-page'),
      shellHidden:getComputedStyle(document.querySelector('.shell')).display==='none',
      position:getComputedStyle(document.querySelector('.overlay')).position,
      bodyOverflow:getComputedStyle(document.querySelector('.modal-body')).overflowY,
      modalHeight:document.querySelector('.modal').getBoundingClientRect().height,
   }));
   assert.ok(before.classEnabled&&before.shellHidden&&before.position==='relative'&&before.bodyOverflow==='visible',
      formId+' must behave as ordinary scrollable page: '+JSON.stringify(before));
   await page.setViewportSize({width,height:350});
   await page.evaluate(()=>document.querySelector('.modal-body input:last-of-type')?.focus());
   await page.evaluate(()=>document.querySelector('.modal-body input:last-of-type')?.scrollIntoView({block:'center'}));
   const after=await page.evaluate(()=>{
     const fields=[...document.querySelectorAll('.modal-body input')];
     const last=fields.at(-1).getBoundingClientRect();
     const foot=document.querySelector('.modal-footer').getBoundingClientRect();
     return {viewport:innerHeight,scroll:scrollY,lastBottom:last.bottom,footerTop:foot.top,footerBottom:foot.bottom,bodyScroll:document.body.scrollHeight};
   });
   assert.ok(after.bodyScroll>after.viewport+250,formId+' must preserve all fields in document flow');
   assert.ok(after.scroll>0&&after.lastBottom<=after.viewport+5,
      formId+' must allow focus to scroll the real page: '+JSON.stringify(after));
   await page.evaluate(()=>window.closeFormPage());
   await page.waitForTimeout(30);
   assert.ok(await page.locator('.shell').isVisible(),formId+' must restore app shell on cancel');
   assert.equal(await page.locator('.overlay').count(),0);
   await page.setViewportSize({width,height:760});
  }
  await context.close();
 }
}finally{await browser.close();}
console.log('PASS: Android purchase, reminder, expense use invoice-style page scrolling at 320/360/390px');
