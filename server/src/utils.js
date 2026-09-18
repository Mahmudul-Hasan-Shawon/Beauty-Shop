function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'item';
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(v) {
  return v === true || v === 1 || v === '1' || v === 'true';
}

function clampRating(r) {
  const n = toNum(r, 4.5);
  return Math.min(5, Math.max(1, Math.round(n * 10) / 10));
}

function ud(n = 8) {
  const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function nowISO() {
  return new Date().toISOString();
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function round(v, d = 2) {
  const p = Math.pow(10, d);
  return Math.round(v * p) / p;
}

function ok(res, data, meta) {
  return res.json({ success: true, data, meta });
}

function fail(res, status, message, errors) {
  return res.status(status).json({ success: false, message, errors });
}

module.exports = { slugify, toNum, toBool, clampRating, ud, nowISO, asyncHandler, round, ok, fail };