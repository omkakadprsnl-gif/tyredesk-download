export const tyreText = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
export const tyreKey = value => tyreText(value).toLowerCase();
export const isStockProduct = item => item?.type === 'tyre' || item?.type === 'product';
export function inventoryCategories(settings) {
  const categories=settings?.inventoryCategories||[];
  return [categories.find(category=>category.id==='tyres')||{id:'tyres',name:'Tyres',fields:[]},
    ...categories.filter(category=>category.id!=='tyres')];
}
export const productCategory = (settings,item) => inventoryCategories(settings).find(category=>category.id===(item.type==='tyre'?'tyres':item.categoryId));
const sizeKey = value => tyreKey(value).replace(/\s*\/\s*/g, '/').replace(/(\d)\s*([rz]+)\s*(?=\d)/g, '$1$2');

export function tyreIdentity(mode, values) {
  if (mode !== 'simple' && mode !== 'detailed') return '';
  const brand = tyreKey(values.brand);
  if (!brand) return '';
  if (mode === 'simple') return JSON.stringify([brand]);
  const model = tyreKey(values.model), size = sizeKey(values.size);
  return model && size ? JSON.stringify([brand, model, size]) : '';
}

export function tyreName(product, mode) {
  const brand = tyreText(product.brand) || product.name;
  return mode === 'simple' ? brand : [brand, product.model, product.size].filter(Boolean).join(' · ');
}

export function inventoryMode(settings, catalog) {
  return settings?.inventoryMode || (catalog.some(p => p.type === 'tyre') ? 'detailed' : '');
}

