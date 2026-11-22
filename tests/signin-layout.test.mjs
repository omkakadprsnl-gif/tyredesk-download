import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import {chromium} from 'playwright';
import {mockShopAccount,signIn} from './shop-account.mjs';

const root=new URL('../docs/app/',import.meta.url);
const contentTypes={html:'text/html',mjs:'text/javascript',js:'text/javascript',css:'text/css'};
const server=http.createServer(async(req,res)=>{
  try{
    const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
    const file=new URL(name,root);
    if(!file.href.startsWith(root.href))return res.writeHead(404).end();
    res.setHeader('Content-Type',contentTypes[name.split('.').at(-1)]||'application/octet-stream');
    res.end(await fs.readFile(file));
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch();
const url='http://127.0.0.1:'+server.address().port;
const announce=page=>page.evaluate(()=>window.dispatchEvent(new CustomEvent('tyredesk-native-update',{
  detail:{phase:'available',message:'TyreDesk 1.3.8 is available. Download it from the official website.'}
})));

async function open(width){
  const context=await browser.newContext({viewport:{width,height:800},hasTouch:width<=390,serviceWorkers:'block'});
  const shop=mockShopAccount();
  await shop.attach(context);
  await context.addInitScript(()=>{
    window.pilotUpdatePageOpens=0;
    window.TyreDeskAndroid={
      stageBackupSnapshot(){},
      getBackupStatus(){return '{}';},
      checkForUpdate(){},
      openUpdatePage(){window.pilotUpdatePageOpens++;}
    };
  });
  const page=await context.newPage();
  await page.goto(url);
  await page.locator('#cloud-form').waitFor();
  return {context,page,shop};
}

async function fits(page,bannerVisible,label){
  const layout=await page.evaluate(()=>{
    const area=document.querySelector('.setup-form-area');
    const holder=area.querySelector(':scope > [data-update-banner]');
    const form=area.querySelector(':scope > .setup-form').getBoundingClientRect();
    const banner=holder.getBoundingClientRect();
    return {stack:getComputedStyle(area).flexDirection,formWidth:form.width,bannerWidth:banner.width,
      bannerHeight:banner.height,bannerBottom:banner.bottom,formTop:form.top,
      overflow:document.documentElement.scrollWidth>innerWidth,viewport:innerWidth};
  });
  assert.equal(layout.stack,'column',label);
  assert.equal(layout.overflow,false,label);
  assert.ok(layout.formWidth>=Math.min(560,layout.viewport-50),label);
  if(bannerVisible){
    assert.equal(layout.bannerWidth,layout.formWidth,label);
    assert.ok(layout.bannerHeight>0&&layout.bannerBottom<=layout.formTop,label);
  }else assert.equal(layout.bannerHeight,0,label);
}

try{
  for(const width of [320,360,390,1440]){
    const {context,page}=await open(width);
    await fits(page,false,'Sign-in without an update at '+width);
    await announce(page);
    await page.locator('.update-banner').waitFor();
    await fits(page,true,'Sign-in with an update at '+width);
    if(width===360){
      await page.getByRole('button',{name:'Open Download Page'}).click();
      assert.equal(await page.evaluate(()=>window.pilotUpdatePageOpens),1);
    }
    if(width<=390){
      await page.setViewportSize({width,height:480});
      for(const selector of ['[name=username]','[name=password]','[name=allowSync]','#cloud-form button[type=submit]']){
        const control=page.locator(selector);
        await control.scrollIntoViewIfNeeded();
        const box=await control.boundingBox();
        assert.ok(box&&box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=480,selector+' at '+width);
      }
      assert.equal(await page.locator('[name=allowSync]').isChecked(),false);
    }
    await context.close();
  }

  const flow=await open(360);
  await announce(flow.page);
  flow.shop.control.failRead=true;
  await signIn(flow.page);
  await flow.page.getByRole('button',{name:'Try again'}).waitFor();
  await fits(flow.page,true,'Sign-in retry with an update');
  flow.shop.control.failRead=false;
  await flow.page.getByRole('button',{name:'Try again'}).click();
  await flow.page.locator('#setup-form').waitFor();
  await fits(flow.page,true,'Shop setup with an update');
  await flow.context.close();

  const pin=await open(360);
  pin.shop.records.set('settings/shop',{kind:'settings',key:'shop',rev:1,doc:{id:'shop',name:'Preset test shop'}});
  await announce(pin.page);
  await signIn(pin.page);
  await pin.page.locator('#device-pin-form').waitFor();
  await fits(pin.page,true,'Device PIN with an update');
  await pin.context.close();
  console.log('PASS: stacked sign-in, setup, retry and PIN at mobile and desktop widths; Android update action and keyboard-height controls');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
