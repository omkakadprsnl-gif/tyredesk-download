export function mockShopAccount({ref='aaaaaaaaaaaaaaaaaaaa',alias='fixture',owner='test-owner'}={}){
 const records=new Map(),devices=new Map(),receipts=new Map();
 let revision=0,lastDelete=0,billing;
 const control={paused:false,loseAck:false,billingHandover:true};
 async function attach(ctx){
 await ctx.route('https://omkakadprsnl-gif.github.io/tyredesk-download/shop-directory.json',route=>
  route.fulfill({json:{[alias]:{ref,key:'sb_publishable_fixture'}},headers:{'access-control-allow-origin':'*'}}));
 await ctx.route('https://'+ref+'.supabase.co/**',async route=>{
  const req=route.request(),endpoint=new URL(req.url()).pathname.split('/').at(-1);
  const send=(data,status=200)=>route.fulfill({status,json:data,headers:{'access-control-allow-origin':'*'}});
  if(control.paused||(control.failRead&&endpoint==='tyredesk_page'))return send({message:'Project is paused'},540);
  if(endpoint==='token'){
    if(req.postDataJSON()?.email!==alias+'@shop.tyredesk.invalid')return send({message:'Invalid credentials'},400);
    const b64=obj=>Buffer.from(JSON.stringify(obj)).toString('base64url');
    const exp=Math.floor(Date.now()/1000)+3600;
    return send({access_token:b64({alg:'HS256'})+'.'+b64({sub:owner,exp})+'.c2ln',refresh_token:'fixture',token_type:'bearer',expires_in:3600,expires_at:exp,user:{id:owner,email:alias+'@shop.tyredesk.invalid'}});
  }
  const b=req.postDataJSON()||{};
  if(endpoint==='tyredesk_device'){if(!devices.has(b.token))devices.set(b.token,devices.size+1);return send(devices.get(b.token));}
  if(endpoint==='tyredesk_head')return send({revision,lastDelete,databaseBytes:1024,...(control.billingHandover?{billingHandover:true}:{})});
  if(endpoint==='tyredesk_receipt')return send(receipts.get(b.write_token)??-1);
  if(endpoint==='tyredesk_page')return send([...records.values()].filter(x=>x.rev>b.since_revision&&(x.kind>b.after_kind||x.kind===b.after_kind&&x.key>b.after_key)).sort((x,y)=>x.kind<y.kind?-1:x.kind>y.kind?1:x.key<y.key?-1:1).slice(0,100));
  const owns=!!billing&&billing.device===b.device_token&&billing.token===b.grant_token;
  if(endpoint==='tyredesk_billing_status')return send(owns?'own':billing?'busy':'free');
  if(endpoint==='tyredesk_billing_claim'){
    if(owns)return send('own');
    if(billing)return send('busy');
    if(b.expected_revision!==revision)return send('stale');
    billing={device:b.device_token,token:b.grant_token};
    if(control.loseClaimAck){control.loseClaimAck=false;return route.abort('connectionreset');}
    return send('own');
  }
  if(endpoint==='tyredesk_billing_release'){
    if(owns){
      if(b.expected_revision!==revision)return send('stale');
      billing=undefined;
      revision++;
      if(control.loseReleaseAck){control.loseReleaseAck=false;return route.abort('connectionreset');}
    }
    return send('released');
  }
  if(endpoint==='tyredesk_commit'||endpoint==='tyredesk_billing_commit'){
    if(control.billingHandover&&endpoint==='tyredesk_commit'&&(revision!==0||b.changes[0].kind!=='settings'||
      b.changes.slice(1).some(row=>row.kind!=='catalog'||row.doc?.type!=='service'||row.doc.trackStock!==false)))
      return send({message:'Update TyreDesk and start billing on this device'},400);
    if(endpoint==='tyredesk_billing_commit'&&!owns)return send({message:'This device does not hold billing access'},400);
    if(receipts.has(b.write_token))return send(receipts.get(b.write_token));
    if(b.expected_revision!==revision)return send(-1);
    revision++;for(const c of b.changes){const k=c.kind+'/'+c.key;if(c.doc)records.set(k,{...c,rev:revision});else{records.delete(k);lastDelete=revision;}}
    receipts.set(b.write_token,revision);
    if(control.loseAck){control.loseAck=false;return route.abort('connectionreset');}
    return send(revision);
  }
  return send({},404);
 });

 }
 return {attach,control,records};
}
export async function signIn(page){
 const form=page.locator('#cloud-form');
 await form.locator('[name=username]').fill('fixture');
 await form.locator('[name=password]').fill('fixture-only');
 await form.locator('[name=allowSync]').check();await form.locator('[type=submit]').click();
}
