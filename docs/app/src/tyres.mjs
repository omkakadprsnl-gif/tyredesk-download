export const tyreText = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
export const tyreKey = value => tyreText(value).toLowerCase();
export const isStockProduct = item => item?.type === 'tyre' || item?.type === 'product';

export function inventoryCategories(settings) {
  const categories=settings?.inventoryCategories||[];
  return [categories.find(category=>category.id==='tyres')||{id:'tyres',name:'Tyres',fields:[]},
    ...categories.filter(category=>category.id!=='tyres')];
}
export const tyreFields = settings => inventoryCategories(settings)[0].fields||[];
export const stockKeyFields = settings => tyreFields(settings).filter(field=>field.stockKey===true);
export const productCategory = (settings,item) =>
  inventoryCategories(settings).find(category=>category.id===(item.type==='tyre'?'tyres':item.categoryId));
const sizeKey = value => tyreKey(value).replace(/\s*\/\s*/g, '/').replace(/(\d)\s*([rz]+)\s*(?=\d)/g, '$1$2');

/**
 * Legacy stock keeps its exact one/three-element identity. For opt-in variant
 * fields, append a keyed object using stable field IDs. Blank identity fields
 * cannot be used to create new variants; legacy records remain unmodified.
 */
export function tyreIdentity(mode, values, settings) {
  if (mode !== 'simple' && mode !== 'detailed') return '';
  const brand=tyreKey(values.brand);
  if(!brand)return '';
  const base=mode==='simple'?[brand]:[brand,tyreKey(values.model),sizeKey(values.size)];
  if(base.some(value=>!value))return '';
  const keys=stockKeyFields(settings);
  if(!keys.length)return JSON.stringify(base);
  const details={};
  for(const field of keys){
    const val=tyreKey(values.attributes?.[field.id]);
    if(!val)return '';
    details[field.id]=val;
  }
  return JSON.stringify([...base,details]);
}
export function isVariantTyre(item) {
  if(item?.type!=='tyre'||!item.tyreIdentity)return false;
  try{
    const id=JSON.parse(item.tyreIdentity);
    const base=item.inventoryMode==='simple'?1:3;
    return Array.isArray(id)&&id.length===base+1&&id[base]&&
      typeof id[base]==='object'&&!Array.isArray(id[base]);
  }catch{return false;}
}
export function tyreName(product,mode,settings) {
  const brand=tyreText(product.brand)||product.name;
  const base=mode==='simple'?brand:[brand,product.model,product.size].filter(Boolean).join(' · ');
  const extras=tyreFields(settings).filter(field=>tyreText(product.attributes?.[field.id]))
    .map(field=>field.label+': '+tyreText(product.attributes[field.id]));
  return [base,...extras].join(' · ');
}
export function tyreSearchText(product,mode,settings) {
  return [tyreName(product,mode,settings),product.supplier||'',
    ...tyreFields(settings).map(field=>field.label+' '+(product.attributes?.[field.id]||''))]
    .join(' ').toLocaleLowerCase();
}
export function inventoryMode(settings,catalog) {
  return settings?.inventoryMode||(catalog.some(p=>p.type==='tyre')?'detailed':'');
}
