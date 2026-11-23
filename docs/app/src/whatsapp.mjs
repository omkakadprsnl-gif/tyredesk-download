/**
 * A WhatsApp-ready bill is plain text, not a PDF. No external API, token or service.
 * The app only creates a draft link; the owner presses Send in WhatsApp.
 */
import {formatMoney} from './logic.mjs';
import {t} from './i18n.mjs';

const rupees = (paise, lang) => formatMoney(Number(paise || 0), lang);
const value = (x) => String(x ?? '').trim();
const safeLine = (x) => value(x).replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');

/** Only target a recipient when the provided number is a valid-looking Indian mobile number. */
export function whatsappRecipient(phone) {
  const raw = value(phone);
  if (!raw || /[a-z]/i.test(raw)) return null;
  const digits = raw.replace(/[^\d]/g, '');
  const mobile = digits.length === 10 ? digits :
    digits.length === 12 && digits.startsWith('91') ? digits.slice(2) :
    digits.length === 13 && digits.startsWith('091') ? digits.slice(3) : null;
  if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) return null;
  return `91${mobile}`;
}

/** Format from frozen invoice data so later shop or price edits do not change prior bills. */
export function formatWhatsAppBill(order, lang = 'en') {
  if (!order || !order.number || !order.totals) throw new Error('Invoice data is missing');
  const shop = order.shopSnapshot || {};
  const customer = order.customerSnapshot || {};
  const totals = order.totals || {};
  const lines = order.items || [];
  const date = new Date(order.createdAt);
  if (!Number.isFinite(date.getTime())) throw new Error('Invoice date is invalid');
  const dateLocale = lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : 'en-IN';
  const header = shop.gstRegistered ? 'TAX INVOICE' : 'BILL / INVOICE';
  const msg = [];
  msg.push(`*${safeLine(shop.name || 'TyreDesk')}*`);
  const address = [shop.address, shop.city, shop.state].map(safeLine).filter(Boolean).join(', ');
  if (address) msg.push(address);
  if (shop.phone) msg.push(`${t('phone', lang)}: ${safeLine(shop.phone)}`);
  if (shop.gstRegistered && shop.gstin) msg.push(`GSTIN: ${safeLine(shop.gstin)}`);
  msg.push('━━━━━━━━━━━━━━━━━━━━');
  msg.push(`*${header}*`);
  msg.push(`${t('invoiceNumber', lang)}: ${safeLine(order.number)}`);
  msg.push(`${t('date', lang)}: ${date.toLocaleDateString(dateLocale, {day:'2-digit',month:'short',year:'numeric'})}`);
  msg.push(`${t('customer', lang)}: ${safeLine(customer.name || 'Walk-in customer')}`);
  if (order.vehicle) msg.push(`${t('vehicle',lang)}: ${safeLine(order.vehicle)}`);
  msg.push('━━━━━━━━━━━━━━━━━━━━');
  for (const [i, item] of lines.entries()) {
    msg.push(`*${i + 1}. ${safeLine(item.name || 'Service / Tyre')}*`);
    msg.push(item.type==='service'?`Service charge: ${rupees(item.qty*item.unitPaise,lang)}`:`${t('qty',lang)}: ${item.qty}  ×  ${rupees(item.unitPaise,lang)}`);
    const discount = Number(item.itemDiscountPaise || 0) + Number(item.orderDiscountPaise || 0);
    if (discount > 0) msg.push(`${t('discount',lang)}: −${rupees(discount,lang)}`);
    msg.push(`${t('amount',lang)}: ${rupees(item.totalPaise,lang)}`);
  }
  msg.push('━━━━━━━━━━━━━━━━━━━━');
  msg.push(`${t('subtotal',lang)}: ${rupees(totals.subtotalPaise,lang)}`);
  if (totals.itemDiscountPaise > 0) msg.push(`${t('discount',lang)}: −${rupees(totals.itemDiscountPaise,lang)}`);
  if (totals.orderDiscountPaise > 0) msg.push(`${t('billDiscount',lang)}: −${rupees(totals.orderDiscountPaise,lang)}`);
  if (shop.gstRegistered && totals.taxPaise > 0) {
    msg.push(`Taxable value: ${rupees(totals.taxablePaise,lang)}`);
    if (totals.igstPaise > 0) msg.push(`IGST: ${rupees(totals.igstPaise,lang)}`);
    else {
      msg.push(`CGST: ${rupees(totals.cgstPaise,lang)}`);
      msg.push(`SGST: ${rupees(totals.sgstPaise,lang)}`);
    }
  }
  msg.push(`*${t('grandTotal',lang)}: ${rupees(totals.grandPaise,lang)}*`);
  const paid = Math.max(0, Number(order.paidPaise || 0));
  const due = Math.max(0, Number(totals.grandPaise || 0) - paid);
  msg.push(`${t('paid',lang)}: ${rupees(paid,lang)}`);
  msg.push(`*${t('due',lang)}: ${rupees(due,lang)}*`);
  if (order.status === 'cancelled') msg.push('⚠️ *CANCELLED INVOICE — NOT VALID FOR PAYMENT*');
  if (order.notes) msg.push('', safeLine(order.notes));
  if (shop.terms) msg.push(safeLine(shop.terms));
  msg.push('', 'Thank you for choosing us.');
  return msg.join('\n');
}

/** Native WhatsApp URLs prefill text but do not send it. Never include unvalidated recipient digits. */
export function whatsappBillUrl(order, lang='en') {
  const recipient = whatsappRecipient(order.customerSnapshot?.phone);
  const message = formatWhatsAppBill(order, lang);
  return recipient
    ? `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}


/** Friendly, current-balance payment reminder. WhatsApp only opens a draft. */
export function formatPaymentReminder(order, lang = 'en') {
  if (!order?.number || !order?.totals) throw new Error('Invoice data is missing');
  const due = Number(order.duePaise ?? (Number(order.totals.grandPaise || 0) - Number(order.paidPaise || 0)));
  if (order.status === 'cancelled' || !Number.isSafeInteger(due) || due <= 0)
    throw new Error('This invoice has no outstanding payment');
  const shop = safeLine(order.shopSnapshot?.name || 'Our workshop');
  const customer = safeLine(order.customerSnapshot?.name || 'Customer');
  const number = safeLine(order.number);
  const date = new Date(order.createdAt);
  if (!Number.isFinite(date.getTime())) throw new Error('Invoice date is invalid');
  const dateLocale = lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : 'en-IN';
  const dateLabel = date.toLocaleDateString(dateLocale, {day:'2-digit',month:'short',year:'numeric'});
  const amount = rupees(due, lang);
  if (lang === 'hi') return [
    `नमस्ते ${customer},`, '',
    `*${shop}* की ओर से आपके बाकी भुगतान का विनम्र रिमाइंडर।`,
    `बिल नंबर: ${number}`, `बिल की तारीख: ${dateLabel}`,
    `*बाकी रकम: ${amount}*`, '',
    'कृपया सुविधानुसार भुगतान कर दें। अगर आपने पहले ही भुगतान कर दिया है, तो इस संदेश को नज़रअंदाज़ करें या हमें जानकारी दें।',
    'धन्यवाद।'
  ].join('\n');
  if (lang === 'mr') return [
    `नमस्कार ${customer},`, '',
    `*${shop}* कडून बाकी पेमेंटसाठी नम्र आठवण.`,
    `बिल क्रमांक: ${number}`, `बिल दिनांक: ${dateLabel}`,
    `*बाकी रक्कम: ${amount}*`, '',
    'कृपया सोयीनुसार पेमेंट करा. पेमेंट आधीच केले असल्यास हा संदेश दुर्लक्ष करा किंवा आम्हाला कळवा.',
    'धन्यवाद.'
  ].join('\n');
  return [
    `Hello ${customer},`, '',
    `A friendly payment reminder from *${shop}*.`,
    `Invoice: ${number}`, `Invoice date: ${dateLabel}`,
    `*Amount outstanding: ${amount}*`, '',
    'Please arrange payment when convenient. If you have already paid, kindly ignore this message or let us know.',
    'Thank you!'
  ].join('\n');
}

/** Requires a verified-looking mobile number. This does not auto-send a message. */
export function whatsappReminderUrl(order, lang='en', phone=order?.customerSnapshot?.phone) {
  const recipient = whatsappRecipient(phone);
  if (!recipient) throw new Error('Add a valid customer WhatsApp number first');
  return `https://wa.me/${recipient}?text=${encodeURIComponent(formatPaymentReminder(order,lang))}`;
}
