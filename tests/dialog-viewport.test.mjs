import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const main=await fs.readFile(new URL('../docs/app/src/main.mjs',import.meta.url),'utf8');
const css=await fs.readFile(new URL('../docs/app/styles.css',import.meta.url),'utf8');
const start=main.indexOf('function fitModalBodyToViewport(){');
const end=main.indexOf('\nfunction modal(',start);
assert.ok(start>=0&&end>start,'The native keyboard dialog size helper must exist');
assert.ok(main.includes('requestAnimationFrame(fitModalBodyToViewport)'),'A newly opened dialog must be sized');
assert.ok(main.includes('requestAnimationFrame(()=>{fitModalBodyToViewport();'),'The form must be resized after a visual viewport change');
const fitSource=main.slice(start,end);
const escapeCss=css.replaceAll('</style>','');
const browser=await chromium.launch();
try{
 for(const [width,height] of [[360,420],[390,320],[320,340]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage();
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
   <style>${escapeCss}
    /* Emulate Android WebView's reported collapsed form pane. */
    .overlay .modal-body{flex:none!important;height:30px!important}
   </style></head><body><div id="app"><div id="modal-host">
   <div class="overlay"><div class="modal" role="dialog">
   <div class="modal-head"><h2>Add purchased tyres</h2><button>Close</button></div>
   <div class="modal-body"><form id="purchase-form"><div class="field-grid">
   ${Array.from({length:8},(_,i)=>`<div class="field"><label>Field ${i+1}</label><input placeholder="Entry ${i+1}"></div>`).join('')}
   </div></form></div>
   <div class="modal-footer"><button class="button">Cancel</button><button class="button primary">Save purchase</button></div>
   </div></div></div></div></body></html>`);
  await page.evaluate(h=>{document.documentElement.classList.add('keyboard-open');document.documentElement.style.setProperty('--visible-screen-height',h+'px');},height-10);
  await page.addScriptTag({content:fitSource});
  const before=await page.evaluate(()=>document.querySelector('.modal-body').getBoundingClientRect().height);
  assert.ok(before<80,`Expected simulated collapsed form at ${width}x${height}, got ${before}`);
  await page.evaluate(()=>fitModalBodyToViewport());
  const geom=await page.evaluate(()=>{
   const rect=selector=>document.querySelector(selector).getBoundingClientRect();
   const dialog=rect('.modal'),body=rect('.modal-body'),footer=rect('.modal-footer');
   const form=document.querySelector('.modal-body');
   return {dialogBottom:dialog.bottom,bodyHeight:body.height,footerBottom:footer.bottom,
     scrollHeight:form.scrollHeight,clientHeight:form.clientHeight};
  });
  assert.ok(geom.bodyHeight>=100,`Form pane failed to expand: ${width}x${height} ${JSON.stringify(geom)}`);
  assert.ok(geom.footerBottom<=geom.dialogBottom+1&&geom.footerBottom>=geom.dialogBottom-4,
    `Footer must remain at dialog bottom: ${JSON.stringify(geom)}`);
  assert.ok(geom.scrollHeight>geom.clientHeight,`Long purchase form must remain scrollable: ${JSON.stringify(geom)}`);
  await page.evaluate(()=>{document.querySelector('.modal-body').scrollTop=99999;});
  assert.ok(await page.locator('.modal-body').evaluate(el=>el.scrollTop)>0,'The form should scroll to the last field');
  await context.close();
 }
}finally{await browser.close();}
console.log('Android keyboard-safe modal geometry and scroll regression passed');
