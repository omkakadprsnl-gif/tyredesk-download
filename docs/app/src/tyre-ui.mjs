import {escapeHTML as E, fromPaise} from './logic.mjs';
import {tyreKey, tyreName, tyreIdentity} from './tyres.mjs';

const label = key => ({brand:'Brand',model:'Model',size:'Size'})[key];
const dimensions = mode => mode === 'simple' ? ['brand'] : ['brand','model','size'];
const options = values => [...new Map(values.filter(Boolean).map(v=>[tyreKey(v),v])).values()].sort((a,b)=>a.localeCompare(b));
const filterBy = (items,key,value) => items.filter(p=>tyreKey(p[key])===tyreKey(value));
const formatted = value => fromPaise(value||0);

export function modeChoices(current='', locked=false) {
  const modes=[
    {key:'simple',name:'Simple Inventory',description:'Track tyres by brand. Record purchases by brand and quantity. On a bill, choose the brand and enter the quantity and price.',example:'MRF — 20 tyres'},
    {key:'detailed',name:'Detailed Inventory',description:'Track each brand, model and size separately. Choose all three when you buy or sell tyres so the right stock is updated.',example:'MRF → ZLX → 145/80 R12 — 10 tyres'}
  ];
  return `<fieldset class="mode-choices" ${locked?'disabled':''}><legend>Choose your inventory mode</legend>${modes.map(m=>`
    <label class="mode-choice"><input type="radio" name="inventoryMode" value="${m.key}" ${current===m.key?'checked':''} required>
    <span><strong>${m.name}</strong>${m.key==='detailed'?'<small>Recommended</small>':''}<span>${m.description}</span><em>${m.example}</em></span></label>`).join('')}</fieldset>
    ${locked?'<p class="small-muted">This setting is locked because this shop already has tyre stock records. Changing how stock is grouped requires reassigning stock and its history.</p>':''}`;
}

export function purchaseFields(mode, product) {
  const fields=dimensions(mode).map(key=>`<label class="field">${label(key)}
    <input required name="${key}" maxlength="90" list="buy-list-${key}" value="${E(product?.[key]||'')}" autocomplete="off">
    <datalist id="buy-list-${key}"></datalist>
  </label>`).join('');
  return `<div class="field-grid tyre-fields">
    ${product?`<p class="field-spread"><strong>${E(tyreName(product,mode))}</strong> · Current stock <strong>${product.stockQty||0}</strong></p>`:fields}
    <label class="field">How many tyres did you buy?<input name="qty" type="number" min="1" step="1" value="1" required></label>
    <label class="field">Purchase price per tyre (₹)<input name="cost" type="number" min="0" step="0.01" value="${product?formatted(product.costPaise):''}" required></label>
    <label class="field">Selling price per tyre (₹)<input name="price" type="number" min="0" step="0.01" value="${product?formatted(product.pricePaise):''}" required></label>
    <label class="field">Supplier (optional)<input name="supplier" maxlength="150"></label>
    <label class="field field-spread">Supplier invoice reference (optional)<input name="reference" maxlength="80"></label>
    ${product?'':'<p class="small-muted field-spread" data-purchase-match></p>'}
  </div>`;
}

export function updatePurchaseFields(form, mode, tyres, changed='') {
  const entries={};
  for(const key of dimensions(mode)){
    const input=form.elements.namedItem(key);
    if(!input)return;
    if((changed==='brand'&&key!=='brand')||(changed==='model'&&key==='size'))input.value='';
    form.querySelector('#buy-list-'+key).innerHTML=options(tyres.map(p=>p[key])).map(v=>`<option value="${E(v)}"></option>`).join('');
    entries[key]=input.value;
    tyres=filterBy(tyres,key,input.value);
  }
  const identity=tyreIdentity(mode,entries);
  const match=identity && tyres.find(p=>tyreIdentity(mode,p)===identity);
  form.querySelector('[data-purchase-match]').textContent=match?`Current stock is ${match.stockQty||0}. This purchase adds to that stock.`:'';
  if(match){
    for(const [field,value] of [['cost',match.costPaise],['price',match.pricePaise]]){
      const input=form.elements[field];
      if(!input.dataset.edited)input.value=formatted(value);
    }
  }
}

export function tyrePicker(mode, tyres) {
  const hasLegacy=tyres.some(p=>!tyreIdentity(mode,p));
  return `<form id="tyre-bill-form" class="field-grid tyre-fields">
    ${dimensions(mode).map(key=>`<label class="field">${label(key)}<select name="${key}" required><option value="">Choose ${label(key).toLowerCase()}</option></select></label>`).join('')}
    <label class="field" data-exact-tyre hidden>Stock entry<select name="exact"></select></label>
    <label class="field">Quantity<input type="number" name="qty" min="1" step="1" value="1" required></label>
    <label class="field">Price per tyre (₹)<input type="number" name="price" min="0" step="0.01" required></label>
    <p data-bill-stock class="small-muted field-spread" aria-live="polite"></p>
    <button type="submit" class="button field-spread">Add tyre to bill</button>
  </form>${hasLegacy?`<details class="legacy-tyres"><summary>Existing stock with missing tyre details</summary>
    <ul>${tyres.filter(p=>!tyreIdentity(mode,p)).map(p=>`<li><button type="button" class="button" data-legacy-tyre="${E(p.id)}">${E(tyreName(p,mode))} · ${p.stockQty||0} in stock</button></li>`).join('')}</ul></details>`:''}`;
}

export function updateTyrePicker(form, mode, catalog, changed='') {
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
    clear ||= changed===key;
  }
  const exact=form.elements.exact;
  const previous=changed==='exact'?exact.value:'';
  exact.replaceChildren(...matching.map(p=>new Option(tyreName(p,mode)+' · '+(p.stockQty||0)+' in stock',p.id)));
  if(previous)exact.value=previous;
  exact.parentElement.hidden=matching.length<2;
  exact.disabled=matching.length<2;
  const product=matching.find(p=>p.id===exact.value);
  form.dataset.product=product?.id||'';
  form.querySelector('[data-bill-stock]').textContent=product?`${product.stockQty||0} tyres in stock`:'Choose a tyre to see its stock and price.';
  form.elements.price.value=product?formatted(product.pricePaise):'';
  form.elements.qty.max=product?.stockQty||'';
  form.querySelector('button').disabled=!(product?.stockQty>0);
}

