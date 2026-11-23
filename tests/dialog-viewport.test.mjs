import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const css=await fs.readFile(new URL('../docs/app/styles.css',import.meta.url),'utf8');
const main=await fs.readFile(new URL('../docs/app/src/main.mjs',import.meta.url),'utf8');
assert.match(css,/grid-template-rows:auto minmax\(0,1fr\) auto!important/,'Mobile dialogs require three fixed grid rows');
assert.ok(!css.includes('max-height:35%!important'),'Percentage-based footer height shrinks on Android');
assert.ok(main.includes('viewport.addEventListener(\'resize\',viewportChanged)'),'Visible viewport must track the Android keyboard');

const browser=await chromium.launch();
try{
 for(const [width,initialHeight,keyboardHeight] of [[320,820,510],[390,820,325],[360,790,415]]){
  const context=await browser.newContext({viewport:{width,height:initialHeight},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage();
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>${css.replaceAll('</style>','')}</style></head><body>
    <div id="app"><div id="modal-host"><div class="overlay purchase-dialog">
    <div class="modal" role="dialog"><div class="modal-head"><h2>Add purchased tyres</h2><button>Close</button></div>
    <div class="modal-body"><form id="purchase-form"><div class="field-grid">
    ${Array.from({length:8},(_,i)=>`<div class="field"><label>Field ${i+1}</label><input placeholder="Entry ${i+1}"></div>`).join('')}
    </div></form></div>
    <div class="modal-footer"><button class="button">Cancel</button><button class="button primary">Save purchase</button></div>
    </div></div></div></div></body></html>`);
  const check=async label=>{
   const geom=await page.evaluate(()=>{
    const rect=sel=>document.querySelector(sel).getBoundingClientRect();
    const modal=rect('.modal'),body=rect('.modal-body'),footer=rect('.modal-footer');
    const container=document.querySelector('.modal-body');
    return {modalBottom:modal.bottom,footerBottom:footer.bottom,bodyHeight:body.height,
      scrollHeight:container.scrollHeight,clientHeight:container.clientHeight,
      display:getComputedStyle(document.querySelector('.modal')).display};
   });
   assert.equal(geom.display,'grid',label+' must use grid, not flex');
   assert.ok(geom.footerBottom<=geom.modalBottom+2&&geom.footerBottom>=geom.modalBottom-4,
     label+' footer not anchored: '+JSON.stringify(geom));
   assert.ok(geom.bodyHeight>=100,label+' form collapsed: '+JSON.stringify(geom));
   assert.ok(geom.scrollHeight>geom.clientHeight,label+' form not scrollable: '+JSON.stringify(geom));
   await page.evaluate(()=>document.querySelector('.modal-body').scrollTop=99999);
   assert.ok(await page.locator('.modal-body').evaluate(el=>el.scrollTop)>0,label+' cannot scroll down to additional fields');
  };
  await page.evaluate(h=>document.documentElement.style.setProperty('--visible-screen-height',h+'px'),initialHeight);
  await check('before keyboard '+width);
  await page.evaluate(()=>document.documentElement.classList.add('keyboard-open'));
  await page.setViewportSize({width,height:keyboardHeight});
  await page.evaluate(h=>document.documentElement.style.setProperty('--visible-screen-height',h+'px'),keyboardHeight);
  await check('keyboard open '+width);
  await context.close();
 }
}finally{await browser.close();}
console.log('PASS: Android keyboard dialog grid keeps the long form scrollable and footer at bottom across mobile sizes');
