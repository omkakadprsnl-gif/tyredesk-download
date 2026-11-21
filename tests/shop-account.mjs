export function mockShopAccount(){
 const records=new Map(),devices=new Map(),receipts=new Map();
 let revision=0,lastDelete=0;
 const control={paused:false,loseAck:false};
 async function attach(ctx){
 await ctx.route('https://*.supabase.co/**',async route=>{
  const req=route.request(),endpoint=new URL(req.url()).pathname.split('/').at(-1);
  const send=(data,status=200)=>route.fulfill({status,json:data,headers:{'access-control-allow-origin':'*'}});
  if(control.paused||(control.failRead&&endpoint==='tyredesk_page'))return send({message:'Project is paused'},540);
  if(endpoint==='token'){
    const b64=obj=>Buffer.from(JSON.stringify(obj)).toString('base64url');
    const exp=Math.floor(Date.now()/1000)+3600;
    return send({access_token:b64({alg:'HS256'})+'.'+b64({sub:'test-owner',exp})+'.c2ln',refresh_token:'fixture',token_type:'bearer',expires_in:3600,expires_at:exp,user:{id:'test-owner',email:'test@example.invalid'}});
  }
  const b=req.postDataJSON()||{};
  if(endpoint==='tyredesk_device'){if(!devices.has(b.token))devices.set(b.token,devices.size+1);return send(devices.get(b.token));}
  if(endpoint==='tyredesk_head')return send({revision,lastDelete,databaseBytes:1024});
  if(endpoint==='tyredesk_receipt')return send(receipts.get(b.write_token)??-1);
  if(endpoint==='tyredesk_page')return send([...records.values()].filter(x=>x.rev>b.since_revision&&(x.kind>b.after_kind||x.kind===b.after_kind&&x.key>b.after_key)).sort((x,y)=>x.kind<y.kind?-1:x.kind>y.kind?1:x.key<y.key?-1:1).slice(0,100));
  if(endpoint==='tyredesk_commit'){
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
