export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'item';
}

export function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function toBool(v) {
  return v === true || v === 1 || v === '1' || v === 'true';
}

export function clampRating(r) {
  const n = toNum(r, 4.5);
  return Math.min(5, Math.max(1, Math.round(n * 10) / 10));
}

export function ud(n = 8) {
  const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

export function nowISO() {
  return new Date().toISOString();
}

export function round(v, d = 2) {
  const p = Math.pow(10, d);
  return Math.round(v * p) / p;
}

export function ok(data, meta) {
  return { success: true, data, meta };
}

export function fail(status, message, errors) {
  return { success: false, message, errors, __status: status };
}