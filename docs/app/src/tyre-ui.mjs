import {escapeHTML as E, fromPaise} from './logic.mjs';
import {tyreKey, tyreName, tyreIdentity, stockKeyFields, isVariantTyre, customTyreFields} from './tyres.mjs';

const label = key => ({brand:'Brand',model:'Model',size:'Size'})[key];
const dimensions = mode => mode === 'simple' ? ['brand'] : ['brand','model','size'];
const options = values => [...new Map(values.filter(Boolean).map(v=>[tyreKey(v),v])).values()].sort((a,b)=>a.localeCompare(b));
const filterBy = (items,key,value) => items.filter(p=>tyreKey(p[key])===tyreKey(value));
const formatted = value => fromPaise(value||0);

export function modeChoices(current='', locked=false) {
  const modes=[
    {key:'simple',name:'Simple Inventory',description:'Track tyres by brand. Record purchases by brand and quantity. On a bill, choose the brand and enter the quantity and price.',example:'MRF — 20 tyres'},
    {key:'detailed',name:'Detailed Inventory',description:'Choose which details identify the tyres you sell. Model and Size are optional defaults; configure the fields during shop setup.',example:'MRF → Color → Product Code — 10 tyres'}
  ];
  return `<fieldset class="mode-choices" ${locked?'disabled':''}><legend>Choose your inventory mode</legend>${modes.map(m=>`
    <label class="mode-choice"><input type="radio" name="inventoryMode" value="${m.key}" ${current===m.key?'checked':''} required>
    <span><strong>${m.name}</strong>${m.key==='detailed'?'<small>Recommended</small>':''}<span>${m.description}</span><em>${m.example}</em></span></label>`).join('')}</fieldset>
    ${locked?'<p class="small-muted">This setting is locked because this shop already has tyre stock records. Changing how stock is grouped requires reassigning stock and its history.</p>':''}`;
}

export function purchaseFields(mode, product, settings) {
  const fields=mode==='detailed'&&customTyreFields(settings)
    ? `<label class="field">Brand<input name="brand" required maxlength="90" placeholder="Enter brand" autocomplete="off"></label>`
      +stockKeyFields(settings).map(field=>`<label class="field">${E(field.label)}<input name="attribute-${E(field.id)}" maxlength="160" required placeholder="Enter ${E(field.label)}" autocomplete="off"></label>`).join('')
    :dimensions(mode).map(key=>`<div class="field purchase-identity" data-purchase-dimension="${key}">
    <label for="buy-${key}">${label(key)}</label>
    <select id="buy-${key}" data-purchase-choice="${key}" aria-label="${label(key)}"></select>
    <input name="${key}" maxlength="90" aria-label="New ${key}" placeholder="Enter ${key}" autocomplete="off">
  </div>`).join('');
  return `<div class="field-grid tyre-fields">
    ${product?`<p class="field-spread"><strong>${E(tyreName(product,mode,settings))}</strong> · Current stock <strong>${product.stockQty||0}</strong></p>`:fields}
    <label class="field">How many tyres did you buy?<input name="qty" type="number" min="1" step="1" value="1" required></label>
    <label class="field purchase-cost">Purchase price per tyre (₹)<input name="cost" type="number" min="0" step="0.01" value="${product?formatted(product.costPaise):''}" required></label>
    <label class="field purchase-price">Selling price per tyre (₹)<input name="price" type="number" min="0" step="0.01" value="${product?formatted(product.pricePaise):''}" required></label>
    <label class="field">Supplier (optional)<input name="supplier" maxlength="150"></label>
    <label class="field field-spread">Supplier invoice reference (optional)<input name="reference" maxlength="80"></label>
    ${product?'':'<p class="small-muted field-spread" data-purchase-match></p>'}
  </div>`;
}

export function updatePurchaseFields(form, mode, tyres, changed='', settings=null) {
  if(mode==='detailed'&&customTyreFields(settings)){
    const brand=form.elements.namedItem('brand')?.value||'';
    const attributes=Object.fromEntries(stockKeyFields(settings).map(field=>[
      field.id,form.elements.namedItem('attribute-'+field.id)?.value||''
    ]));
    const identity=tyreIdentity(mode,{brand,attributes},settings);
    const match=identity&&tyres.find(p=>p.tyreIdentity===identity);
    const status=form.querySelector('[data-purchase-match]');
    if(status)status.textContent=!identity?'Enter Brand and the shop-selected tyre details.':
      match?`Current stock is ${match.stockQty||0}. This purchase adds to that exact tyre variant.`:
      'New tyre variant. A separate stock record will be created.';
    if(match)for(const [key,value] of [['cost',match.costPaise],['price',match.pricePaise]]){
      const input=form.elements.namedItem(key);
      if(input&&!input.dataset.edited)input.value=formatted(value);
    }
    return;
  }
  const entries={};
  for(const key of dimensions(mode)){
    const input=form.elements.namedItem(key);
    if(!input)return;
    if((changed==='brand'&&key!=='brand')||(changed==='model'&&key==='size')){
      input.value='';delete input.dataset.manual;
    }
    const ready=key==='brand'||(key==='model'&&!!entries.brand)||(key==='size'&&!!entries.model);
    const group=form.querySelector('[data-purchase-dimension="'+key+'"]');
    const select=group.querySelector('select');
    const saved=options(tyres.map(p=>p[key]));
    const match=saved.find(value=>tyreKey(value)===tyreKey(input.value));
    const manual=input.dataset.manual==='yes'||!!input.value&&!match||!saved.length;
    group.hidden=!ready;
    select.hidden=!saved.length;select.disabled=!ready||select.hidden;select.required=!select.disabled;
    select.replaceChildren(new Option('Choose '+key,''),...saved.map(value=>new Option(value,value)),new Option('Add a new '+key,'__new__'));
    select.value=manual&&saved.length?'__new__':(match||'');
    input.hidden=!manual;input.disabled=!ready;input.required=ready&&manual;
    group.querySelector('label').htmlFor=select.hidden?'buy-'+key+'-manual':'buy-'+key;
    input.id='buy-'+key+'-manual';
    entries[key]=ready?input.value:'';
    tyres=filterBy(tyres,key,entries[key]);
  }
  const fields=stockKeyFields(settings);
  const attributes=Object.fromEntries(fields.map(field=>
    [field.id,form.elements.namedItem('attribute-'+field.id)?.value||'']));
  const identity=tyreIdentity(mode,{...entries,attributes},settings);
  const match=identity&&tyres.find(p=>p.tyreIdentity===identity||
    (!fields.length&&!p.tyreIdentity&&tyreIdentity(mode,p)===identity));
  const status=form.querySelector('[data-purchase-match]');
  if(status)status.textContent=identity
    ?(match?`Current stock is ${match.stockQty||0}. This purchase adds to that exact tyre variant.`:
      'New tyre variant. A separate stock record will be created.')
    :(tyreIdentity(mode,entries)&&fields.length
      ?'Fill every field marked as a separate tyre variant before purchasing.'
      :'');
  if(match){
    for(const [field,value] of [['cost',match.costPaise],['price',match.pricePaise]]){
      const input=form.elements[field];
      if(!input.dataset.edited)input.value=formatted(value);
    }
  }
}

export function tyrePicker(mode, tyres, settings) {
  if(mode==='detailed'&&customTyreFields(settings)){
    const fields=stockKeyFields(settings);
    return `<form id="tyre-bill-form" class="field-grid tyre-fields">
      <label class="field">Brand<select name="brand" required><option value="">Choose brand</option></select></label>
      ${fields.map(f=>`<label class="field">${E(f.label)}<select name="stock-field-${E(f.id)}" data-stock-field="${E(f.id)}" required><option value="">Choose ${E(f.label)}</option></select></label>`).join('')}
      <label class="field" data-exact-tyre hidden>Exact tyre variant<select name="exact"></select></label>
      <label class="field">Quantity<input name="qty" type="number" min="1" step="1" value="1" required></label>
      <label class="field">Price per tyre (₹)<input name="price" type="number" min="0" step="0.01" required></label>
      <p data-bill-stock class="small-muted field-spread" aria-live="polite"></p>
      <button type="submit" class="button field-spread">Add tyre to bill</button>
    </form>`;
  }
  const fields=stockKeyFields(settings);
  const hasLegacy=tyres.some(p=>!tyreIdentity(mode,p)||
    (fields.length&&!isVariantTyre(p)));
  const filters=fields.map(field=>`<label class="field">${E(field.label)}<select name="stock-field-${E(field.id)}" data-stock-field="${E(field.id)}"><option value="">All ${E(field.label)}</option></select></label>`).join('');
  return `<form id="tyre-bill-form" class="field-grid tyre-fields">
    ${dimensions(mode).map(key=>`<label class="field">${label(key)}<select name="${key}" required><option value="">Choose ${label(key).toLowerCase()}</option></select></label>`).join('')}
    ${filters}
    <label class="field" data-exact-tyre hidden>Exact tyre variant<select name="exact"></select></label>
    <label class="field">Quantity<input type="number" name="qty" min="1" step="1" value="1" required></label>
    <label class="field">Price per tyre (₹)<input type="number" name="price" min="0" step="0.01" required></label>
    <p data-bill-stock class="small-muted field-spread" aria-live="polite"></p>
    <button type="submit" class="button field-spread">Add tyre to bill</button>
  </form>${hasLegacy?`<details class="legacy-tyres"><summary>Legacy or unclassified tyre stock</summary>
    <ul>${tyres.filter(p=>!tyreIdentity(mode,p)||(fields.length&&!isVariantTyre(p))).map(p=>`<li><button type="button" class="button" data-legacy-tyre="${E(p.id)}">${E(tyreName(p,mode,settings))} · ${p.stockQty||0} in stock</button></li>`).join('')}</ul></details>`:''}`;
}

export function updateTyrePicker(form, mode, catalog, changed='', settings=null) {
  if(mode==='detailed'&&customTyreFields(settings)){
    let matching=catalog.filter(p=>p.inventoryMode==='detailed'&&
      p.tyreIdentity?.startsWith('["')&&
      (()=>{try{return JSON.parse(p.tyreIdentity)[1]==='custom';}catch{return false;}})());
    const brand=form.elements.namedItem('brand');
    const previousBrand=brand.value;
    const available=options(matching.map(p=>p.brand));
    brand.replaceChildren(new Option('Choose brand',''),...available.map(v=>new Option(v,v)));
    brand.value=available.some(v=>tyreKey(v)===tyreKey(previousBrand))?previousBrand:'';
    matching=brand.value?matching.filter(p=>tyreKey(p.brand)===tyreKey(brand.value)):[];
    let clear=changed==='brand';
    for(const field of stockKeyFields(settings)){
      const select=form.elements.namedItem('stock-field-'+field.id);
      const prior=clear?'':select.value;
      const values=options(matching.map(p=>p.attributes?.[field.id]));
      select.replaceChildren(new Option('Choose '+field.label,''),...values.map(v=>new Option(v,v)));
      select.value=values.some(v=>tyreKey(v)===tyreKey(prior))?prior:'';
      select.disabled=!brand.value||!values.length;
      matching=select.value?matching.filter(p=>tyreKey(p.attributes?.[field.id])===tyreKey(select.value)):[];
      clear ||=changed==='stock-field-'+field.id;
    }
    const exact=form.elements.exact;
    const prev=changed==='exact'?exact.value:'';
    exact.replaceChildren();
    if(matching.length>1)exact.add(new Option('Choose exact tyre variant',''));
    for(const p of matching)exact.add(new Option(tyreName(p,mode,settings)+' · '+(p.stockQty||0)+' in stock',p.id));
    if(matching.length===1)exact.value=matching[0].id;
    else exact.value=prev&&matching.some(p=>p.id===prev)?prev:'';
    exact.parentElement.hidden=matching.length<2;
    exact.disabled=matching.length<2;
    exact.required=matching.length>1;
    const selected=matching.find(p=>p.id===exact.value);
    form.dataset.product=selected?.id||'';
    form.querySelector('[data-bill-stock]').textContent=selected?
      `${selected.stockQty||0} tyres in stock`:
      matching.length>1?'Choose the exact tyre to avoid deducting the wrong stock.':
      'Choose a tyre to see stock and price.';
    form.elements.price.value=selected?formatted(selected.pricePaise):'';
    form.elements.qty.max=selected?.stockQty||'';
    form.querySelector('button').disabled=!(selected?.stockQty>0);
    return;
  }
  const fields=stockKeyFields(settings);
  let matching=catalog.filter(p=>tyreIdentity(mode,p));
  let clear=false;
  for(const key of dimensions(mode)){
    const field=form.elements[key];
    const previous=clear?'':field.value;
    field.replaceChildren(new Option('Choose '+key,''));
    for(const value of options(matching.map(p=>p[key])))field.add(new Option(value,value));
    field.value=[...field.options].some(o=>o.value===previous)?previous:'';
    field.disabled=field.options.length===1;
    matching=field.value?filterBy(matching,key,field.value):[];
    clear ||=changed===key;
  }
  for(const key of fields){
    const select=form.elements.namedItem('stock-field-'+key.id);
    if(!select)continue;
    const prior=clear?'':select.value;
    const possible=options(matching.map(p=>p.attributes?.[key.id]));
    const unclassified=matching.some(p=>!tyreKey(p.attributes?.[key.id]));
    select.replaceChildren(new Option('All '+key.label,''),...possible.map(v=>new Option(v,v)));
    if(unclassified)select.add(new Option('Unclassified stock','__unclassified__'));
    select.value=[...select.options].some(o=>o.value===prior)?prior:'';
    select.disabled=select.options.length<=1;
    if(select.value)matching=matching.filter(p=>
      select.value==='__unclassified__'?!tyreKey(p.attributes?.[key.id]):
      tyreKey(p.attributes?.[key.id])===tyreKey(select.value));
    clear ||=changed==='stock-field-'+key.id;
  }
  const exact=form.elements.exact;
  const previous=changed==='exact'?exact.value:'';
  exact.replaceChildren();
  if(matching.length>1)exact.add(new Option('Choose exact tyre variant',''));
  for(const p of matching)exact.add(new Option(tyreName(p,mode,settings)+' · '+(p.stockQty||0)+' in stock',p.id));
  if(matching.length===1)exact.value=matching[0].id;
  else exact.value=previous&&matching.some(p=>p.id===previous)?previous:'';
  exact.parentElement.hidden=matching.length<2;
  exact.disabled=matching.length<2;
  exact.required=matching.length>1;
  const product=matching.find(p=>p.id===exact.value);
  form.dataset.product=product?.id||'';
  form.querySelector('[data-bill-stock]').textContent=product
    ?`${product.stockQty||0} tyres in stock`
    :(matching.length>1?'Choose the exact tyre variant to avoid deducting the wrong stock.':
      'Choose a tyre to see its stock and price.');
  form.elements.price.value=product?formatted(product.pricePaise):'';
  form.elements.qty.max=product?.stockQty||'';
  form.querySelector('button').disabled=!(product?.stockQty>0);
}
