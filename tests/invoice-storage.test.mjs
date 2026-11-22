import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateBill} from '../docs/app/src/logic.mjs';
import {compactInvoiceLines} from '../docs/app/src/invoice-storage.mjs';

const input=[
  {key:'editor-only',type:'tyre',name:'Tyre 165/80',code:'T-1',catalogId:'tyre-1',qty:2,
   unitPaise:750000,unitCostPaise:600000,taxBps:1800,discount:{type:'fixed',value:5000}},
  {key:'editor-only-2',type:'service',name:'Wheel balancing',qty:1,
   unitPaise:60000,taxBps:1800,discount:{type:'percent',value:1000}},
];
for (const opts of [{registered:false,supplyMode:'intra'},{registered:true,supplyMode:'intra'},{registered:true,supplyMode:'inter'}]) {
  const original=calculateBill(input,{type:'fixed',value:2000},opts);
  const compact=compactInvoiceLines(original.lines);
  for (const row of compact) {
    for(const field of ['key','expanded','gross','afterItemDiscount']) assert.equal(field in row,false);
    for(const field of ['totalPaise','taxablePaise','unitPaise','taxBps']) assert.equal(typeof row[field],'number');
  }
  const recomputed=calculateBill(compact,{type:'fixed',value:2000},opts);
  assert.deepEqual(recomputed.totals,original.totals);
  assert.deepEqual(compact.map(v=>v.totalPaise),original.lines.map(v=>v.totalPaise));
  assert.deepEqual(compact.map(v=>v.unitPaise),original.lines.map(v=>v.unitPaise));
  assert.deepEqual(compact.map(v=>v.unitCostPaise),original.lines.map(v=>v.unitCostPaise));
  assert.deepEqual(compact.map(v=>v.taxBps),original.lines.map(v=>v.taxBps));
  assert.equal(compact[0].catalogId,'tyre-1');
}
const oldBill={shopSnapshot:{name:'Historical Shop',logoData:'data:image/png;base64,legacy'},
  items:calculateBill(input).lines};
assert.equal(oldBill.shopSnapshot.logoData,'data:image/png;base64,legacy');
assert.equal(oldBill.items[0].gross,1500000);
assert.ok(compactInvoiceLines(oldBill.items)[0].totalPaise>=0);
const mainSource=readFileSync(new URL('../docs/app/src/main.mjs',import.meta.url),'utf8');
const orderSource=readFileSync(new URL('../docs/app/src/db.mjs',import.meta.url),'utf8');
assert.doesNotMatch(mainSource,/<input name="logo"[^>]*type="file"/);
assert.doesNotMatch(mainSource,/async function encodeLogo\(/);
assert.doesNotMatch(orderSource,/logoData:settings\.logoData/);
assert.match(orderSource,/items:compactInvoiceLines\(calculated\.lines\)/);
console.log('PASS: compact invoice lines preserve prices, GST and totals; legacy records remain readable');
