export function fmt(n, d = 2) {
  const num = Number(n) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d });
}

export function taka(n) {
  return `${fmt(n)} TK`;
}

export function truncate(s, n = 120) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
}

export function dates(s) {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function discountLabel(p) {
  if (p.discount > 0) return `${p.discount}% OFF`;
  return p.hasDiscount ? 'SALE' : '';
}

export function priceRange(p) {
  const base = p.salePrice || p.price || 0;
  return { price: base, oldPrice: p.originalPrice && p.originalPrice > base ? p.originalPrice : p.price > base ? p.price : 0 };
}

export function classNames(...args) {
  return args.filter(Boolean).join(' ');
}