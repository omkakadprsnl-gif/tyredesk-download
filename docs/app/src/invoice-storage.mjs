// Persist only invoice fields needed to bill, reprint, reconcile, and edit.
// Editor state and intermediate calculation values are reconstructed on demand.
export function compactInvoiceLines(lines) {
  if (!Array.isArray(lines)) throw new TypeError('Invoice lines must be an array');
  return lines.map(({key, expanded, gross, afterItemDiscount, ...stored}) => stored);
}
