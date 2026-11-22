/** Pure business logic. All money amounts are integer paise, not floats. */
export const toPaise = (v) => {
  const s = String(v ?? '').replace(/[,₹\s]/g, '').trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(s)) return NaN;
  const neg = s.startsWith('-');
  const [whole, decimal = ''] = (neg ? s.slice(1) : s).split('.');
  const val = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return neg ? -val : val;
};
export const fromPaise = (v) => ((Number(v) || 0) / 100).toFixed(2);
export const formatMoney = (v, lang = 'en') => new Intl.NumberFormat(lang === 'mr' ? 'mr-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN', {style:'currency',currency:'INR',maximumFractionDigits:2,minimumFractionDigits:2}).format((Number(v) || 0) / 100);
export const normalizePhone = (s) => {
  const d = String(s || '').replace(/\D/g, '');
  return d.length === 12 && d.startsWith('91') ? d.slice(2) : d;
};
export const normalizeVehicle = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const safeText = (s) => String(s ?? '').trim().slice(0, 500);
export const todayISO = (d=new Date()) => { const off = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return off.toISOString().slice(0,10); };
export const monthISO = (d=new Date()) => todayISO(d).slice(0,7);
export const uid = () => crypto.randomUUID();
export function assertMoney(value, label='Amount') {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100000000000) throw new Error(`${label} is invalid`);
}
export function calculateBill(items, orderDiscount={type:'fixed',value:0}, options={registered:false,supplyMode:'intra'}) {
  if (!Array.isArray(items) || !items.length) throw new Error('Add at least one item.');
  const normalized = items.map((src, i) => {
    const qty = Number(src.qty); const rate = Number(src.unitPaise); const discount = src.discount || {type:'fixed',value:0};
    if (!Number.isSafeInteger(qty) || qty < 1 || qty > 9999) throw new Error(`Invalid quantity in row ${i+1}`);
    assertMoney(rate, `Rate in row ${i+1}`);
    const gross = qty * rate; assertMoney(gross, 'Line total');
    let amount;
    if (discount.type === 'percent') {
      const bps = Number(discount.value);
      if (!Number.isInteger(bps) || bps < 0 || bps > 10000) throw new Error(`Invalid discount in row ${i+1}`);
      amount = Math.round(gross * bps / 10000);
    } else {
      amount = Number(discount.value || 0);
      assertMoney(amount, `Discount in row ${i+1}`);
    }
    if (amount > gross) throw new Error(`Discount exceeds item value in row ${i+1}`);
    const taxBps = Number(src.taxBps || 0);
    if (!Number.isInteger(taxBps) || taxBps < 0 || taxBps > 10000) throw new Error('Invalid GST rate');
    return { ...src, qty, unitPaise:rate, discount, taxBps, gross, itemDiscountPaise:amount, afterItemDiscount: gross-amount };
  });
  const beforeOrderDiscount = normalized.reduce((n, v) => n + v.afterItemDiscount,0);
  assertMoney(beforeOrderDiscount,'Subtotal after line discounts');
  let totalOrderDiscount=0;
  if (orderDiscount.type === 'percent') {
    const bps = Number(orderDiscount.value || 0);
    if (!Number.isInteger(bps) || bps < 0 || bps > 10000) throw new Error('Invalid bill discount');
    totalOrderDiscount = Math.round(beforeOrderDiscount*bps/10000);
  } else {
    totalOrderDiscount = Number(orderDiscount.value || 0);
    assertMoney(totalOrderDiscount,'Bill discount');
  }
  if (totalOrderDiscount > beforeOrderDiscount) throw new Error('Bill discount exceeds the bill amount');
  const shares = normalized.map(() => 0);
  if (totalOrderDiscount > 0) {
    const denominator = BigInt(beforeOrderDiscount);
    const remainders = normalized.map((line, index) => {
      const product = BigInt(totalOrderDiscount) * BigInt(line.afterItemDiscount);
      shares[index] = Number(product / denominator);
      return {index, remainder: Number(product % denominator)};
    });
    const remaining = totalOrderDiscount - shares.reduce((sum, share) => sum + share, 0);
    remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    for (const {index} of remainders.slice(0, remaining)) shares[index]++;
  }
  const lines = normalized.map((line, i) => {
    const share = shares[i];
    const taxablePaise = line.afterItemDiscount-share;
    const taxPaise = options.registered ? Math.round(taxablePaise * line.taxBps / 10000) : 0;
    const cgstPaise = options.registered && options.supplyMode !== 'inter' ? Math.floor(taxPaise/2) : 0;
    const sgstPaise = options.registered && options.supplyMode !== 'inter' ? taxPaise-cgstPaise : 0;
    const igstPaise = options.registered && options.supplyMode === 'inter' ? taxPaise : 0;
    return {...line, orderDiscountPaise:share,taxablePaise,taxPaise,cgstPaise,sgstPaise,igstPaise,totalPaise:taxablePaise+taxPaise};
  });
  const sum = (key) => lines.reduce((n,v)=>n+v[key],0);
  const totals = {
    subtotalPaise:sum('gross'),itemDiscountPaise:sum('itemDiscountPaise'),
    orderDiscountPaise:totalOrderDiscount,taxablePaise:sum('taxablePaise'),
    cgstPaise:sum('cgstPaise'),sgstPaise:sum('sgstPaise'),igstPaise:sum('igstPaise'),
    taxPaise:sum('taxPaise'),grandPaise:sum('totalPaise')
  };
  assertMoney(totals.grandPaise,'Bill total');
  return {lines, totals};
}
export function calculateDue(order, payments=[]) {
  const netPaid = payments.reduce((n,p)=>n+Number(p.amountPaise || 0),0);
  const amount = Number(order?.totals?.grandPaise || 0);
  return { paidPaise:netPaid, duePaise:Math.max(0,amount-netPaid), status:order?.status==='cancelled'?'cancelled':netPaid>=amount?'paid':netPaid>0?'partial':'unpaid' };
}
export const csvEscape = (v) => {
  const text = String(v ?? '');
  const neutralized = /^[\s]*[=+@\-]/.test(text) ? "'" + text : text; // Spreadsheet formula injection protection
  return `"${neutralized.replace(/"/g, '""')}"`;
};
export function toCSV(headers, rows) { return '\uFEFF' + [headers.map(csvEscape).join(','), ...rows.map(row => row.map(csvEscape).join(','))].join('\r\n'); }
export function fileSafeName(s) { return String(s||'tyre-shop').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,55).toLowerCase(); }
export function escapeHTML(v='') { return String(v??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/** Estimate accrual-basis margin from historical invoice snapshots, not current inventory costs.
 * Taxes are excluded. Unrecorded tyre costs and operating expenses can make this inaccurate.
 */
export function estimateProfit(orders=[], expenses=[]) {
  let revenuePaise=0, tyreCostPaise=0, missingCostLines=0;
  for(const order of orders){
    if(order.status==='cancelled')continue;
    const lines=order.items||[];
    revenuePaise+=Number(order.totals?.taxablePaise ?? lines.reduce((n,l)=>n+Number(l.taxablePaise ?? (l.totalPaise||0)-(l.taxPaise||0)),0));
    for(const line of lines){
      if(line.type!=='tyre'&&line.type!=='product')continue;
      if(Number.isSafeInteger(line.unitCostPaise)&&line.unitCostPaise>=0){
        tyreCostPaise+=line.qty*line.unitCostPaise;
      } else missingCostLines++;
    }
  }
  const expensesPaise=expenses.reduce((n,e)=>n+Number(e.amountPaise||0),0);
  return {revenuePaise,tyreCostPaise,expensesPaise,estimatedProfitPaise:revenuePaise-tyreCostPaise-expensesPaise,missingCostLines};
}
