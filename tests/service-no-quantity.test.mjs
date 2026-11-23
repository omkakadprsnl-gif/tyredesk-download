import assert from 'node:assert/strict';
import {calculateBill} from '../docs/app/src/logic.mjs';
import {invoiceInner,completeInvoiceHtml} from '../docs/app/src/invoice.mjs';
import {formatWhatsAppBill} from '../docs/app/src/whatsapp.mjs';
const service={type:'service',name:'Wheel alignment',qty:1,unitPaise:80000,taxBps:0,
 discount:{type:'fixed',value:0}};
const tyre={type:'tyre',name:'MRF',qty:2,unitPaise:200000,taxBps:0,
 discount:{type:'fixed',value:0}};
const shopSnapshot={name:'Aai Test Shop',gstRegistered:false};
const bill=items=>{
 const result=calculateBill(items);
 return {number:'TEST-1',createdAt:'2026-11-23T10:00:00Z',status:'paid',
 shopSnapshot,customerSnapshot:{name:'Test'},items:result.lines,totals:result.totals,
 paidPaise:result.totals.grandPaise};
};
const one=bill([service]);
const oneHtml=invoiceInner(one,'a4');
assert.match(oneHtml,/services-only/);
assert.match(oneHtml,/<td><\/td><td>₹80,000\.00|<td><\/td><td>₹800\.00/); // HTML leaves service quantity cell empty
assert.doesNotMatch(oneHtml,/<td>1<\/td><td>₹/);
assert.match(completeInvoiceHtml(one,'80'),/services-only/);
assert.match(formatWhatsAppBill(one),/Service charge:/);
assert.doesNotMatch(formatWhatsAppBill(one),/Qty: 1\s*×/i);
const mixed=bill([tyre,service]);
assert.doesNotMatch(invoiceInner(mixed,'a4'),/class="inv-items services-only"/);
assert.match(invoiceInner(mixed,'a4'),/<td>2<\/td>/);
const legacy=bill([{...service,qty:2}]);
assert.equal(legacy.totals.grandPaise,160000);
assert.match(invoiceInner(legacy,'a4'),/₹1,600\.00/);
console.log('PASS: services have no quantity in invoice displays, while mixed tyre quantities and historical amounts are preserved');
