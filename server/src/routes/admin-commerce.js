const express = require('express');
const db = require('../db');
const { requireAuth, allowRoles } = require('../auth');
const { ok, fail, toNum, nowISO, round } = require('../utils');
const { ORDER_STATUSES, STATUS_LABEL } = require('./store');

const router = express.Router();
router.use(requireAuth);

// ---------------- Orders ----------------
router.get('/orders', (req, res) => {
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || '').trim();
  const payment = String(req.query.payment || '').trim();
  const date = String(req.query.date || '').trim();
  const page = Math.max(1, toNum(req.query.page, 1));
  const perPage = Math.min(50, Math.max(1, toNum(req.query.perPage, 20)));
  const where = ['1=1'];
  const params = {};
  if (q) { where.push('(order_no LIKE @q OR customer_name LIKE @q OR phone LIKE @q)'); params.q = `%${q}%`; }
  if (status) { where.push('status=@st'); params.st = status; }
  if (payment) { where.push('payment_status=@pm'); params.pm = payment; }
  if (date) { where.push('date(created_at)=@d'); params.d = date; }
  const total = db.prepare(`SELECT COUNT(*) c FROM orders WHERE ${where.join(' AND ')}`).get(params).c;
  const rows = db.prepare(`SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: perPage, offset: (page - 1) * perPage });
  ok(res, rows.map((o) => ({ ...o, statusLabel: STATUS_LABEL[o.status] })), { total, page, perPage, pages: Math.ceil(total / perPage) });
});

router.get('/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(toNum(req.params.id));
  if (!order) return fail(res, 404, 'Order not found');
  const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(order.id);
  ok(res, { ...order, statusLabel: STATUS_LABEL[order.status], items, statuses: ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })) });
});

router.put('/orders/:id', allowRoles('admin', 'order_manager'), (req, res) => {
  const id = toNum(req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
  if (!order) return fail(res, 404, 'Order not found');
  const b = req.body || {};
  const nextStatus = String(b.status || order.status).toLowerCase();
  if (!ORDER_STATUSES.includes(nextStatus)) return fail(res, 400, 'Invalid order status.');
  const paymentStatus = String(b.paymentStatus || order.payment_status);
  const overrides = {
    status: nextStatus,
    payment_status: paymentStatus,
    tracking_no: String(b.trackingNo ?? b.tracking_no ?? order.tracking_no),
    admin_note: String(b.adminNote ?? b.admin_note ?? order.admin_note),
    notes: String(b.notes ?? order.notes),
    address: String(b.address ?? order.address),
    city: String(b.city ?? order.city),
    area: String(b.area ?? order.area),
    postal_code: String(b.postalCode ?? b.postal_code ?? order.postal_code),
    updated_at: nowISO()
  };
  db.prepare(`
    UPDATE orders SET status=@status, payment_status=@payment_status, tracking_no=@tracking_no,
      admin_note=@admin_note, notes=@notes, address=@address, city=@city, area=@area,
      postal_code=@postal_code, updated_at=@updated_at WHERE id=@id
  `).run({ ...overrides, id });
  ok(res, { ...db.prepare('SELECT * FROM orders WHERE id=?').get(id), statusLabel: STATUS_LABEL[nextStatus] }, { updated: true, notify: ['shipped', 'delivered', 'cancelled'].includes(nextStatus) });
});

router.delete('/orders/:id', allowRoles('admin'), (req, res) => {
  db.prepare('DELETE FROM orders WHERE id=?').run(toNum(req.params.id));
  ok(res, { deleted: true });
});

// ---------------- Customers ----------------
router.get('/customers', (req, res) => {
  const q = String(req.query.q || '').trim();
  const where = ['1=1'];
  const params = {};
  if (q) { where.push('(name LIKE @q OR phone LIKE @q OR email LIKE @q)'); params.q = `%${q}%`; }
  const rows = db.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM orders o WHERE o.phone=u.phone) AS orderCount,
      (SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.phone=u.phone AND o.status NOT IN ('cancelled','returned')) AS totalSpent,
      (SELECT MAX(o.created_at) FROM orders o WHERE o.phone=u.phone) AS lastOrder
    FROM users u WHERE ${where.join(' AND ')} ORDER BY u.id DESC
  `).all(params);
  ok(res, rows.map((r) => ({ ...r, totalSpent: round(Number(r.totalSpent) || 0) })));
});

router.get('/customers/:id', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(toNum(req.params.id));
  if (!u) return fail(res, 404, 'Customer not found');
  const orders = db.prepare('SELECT * FROM orders WHERE phone=? ORDER BY id DESC LIMIT 50').all(u.phone);
  ok(res, { ...u, orders: orders.map((o) => ({ ...o, statusLabel: STATUS_LABEL[o.status], items: db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id) })) });
});

// ---------------- Reviews ----------------
router.get('/reviews', (req, res) => {
  const status = String(req.query.status || '').trim();
  const q = String(req.query.q || '').trim();
  const where = ['1=1'];
  const params = {};
  if (status) { where.push('r.status=@st'); params.st = status; }
  if (q) { where.push('(r.customer_name LIKE @q OR p.title LIKE @q)'); params.q = `%${q}%`; }
  const rows = db.prepare(`
    SELECT r.*, p.title AS productName, p.slug AS productSlug
    FROM reviews r LEFT JOIN products p ON p.id=r.product_id
    WHERE ${where.join(' AND ')} ORDER BY r.id DESC LIMIT 200
  `).all(params);
  ok(res, rows);
});

router.patch('/reviews/:id', allowRoles('admin', 'editor', 'order_manager'), (req, res) => {
  const id = toNum(req.params.id);
  const existing = db.prepare('SELECT * FROM reviews WHERE id=?').get(id);
  if (!existing) return fail(res, 404, 'Review not found');
  const b = req.body || {};
  const allowed = ['status', 'featured', 'rating'];
  const sets = [];
  const params = { id };
  for (const k of allowed) {
    if (k in b) { sets.push(`${k}=@${k}`); params[k] = k === 'rating' ? Math.min(5, Math.max(1, toNum(b[k], 5))) : String(b[k]); }
  }
  if (sets.length) db.prepare(`UPDATE reviews SET ${sets.join(', ')} WHERE id=@id`).run(params);
  const agg = db.prepare("SELECT AVG(rating) a, COUNT(*) c FROM reviews WHERE product_id=? AND status='approved'").get(existing.product_id);
  db.prepare('UPDATE products SET rating=?, review_count=? WHERE id=?').run(round(agg.a || existing.rating, 1), Number(agg.c), existing.product_id);
  ok(res, db.prepare('SELECT * FROM reviews WHERE id=?').get(id), { updated: true });
});

router.delete('/reviews/:id', allowRoles('admin'), (req, res) => {
  db.prepare('DELETE FROM reviews WHERE id=?').run(toNum(req.params.id));
  ok(res, { deleted: true });
});

// ---------------- Coupons ----------------
router.get('/coupons', (req, res) => {
  ok(res, db.prepare('SELECT * FROM coupons ORDER BY id DESC').all());
});

router.post('/coupons', allowRoles('admin'), (req, res) => {
  const c = req.body || {};
  const code = String(c.code || '').trim().toUpperCase();
  if (!code || !/^[A-Z0-9_-]{3,32}$/.test(code)) return fail(res, 400, 'Coupon code must be 3–32 letters/numbers.');
  if (db.prepare('SELECT id FROM coupons WHERE code=?').get(code)) return fail(res, 400, 'This coupon code already exists.');
  if (!['percent', 'fixed'].includes(c.type)) return fail(res, 400, 'Invalid coupon type.');
  const value = toNum(c.value);
  if (value <= 0 || (c.type === 'percent' && value > 100)) return fail(res, 400, 'Enter a valid coupon value.');
  db.prepare(`
    INSERT INTO coupons (code, type, value, min_order, max_discount, start_date, end_date, usage_limit, categories_json, products_json, enabled)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(code, c.type, value, toNum(c.minOrder, 0), toNum(c.maxDiscount, 0),
    String(c.startDate || ''), String(c.endDate || ''), toNum(c.usageLimit, 0),
    JSON.stringify(Array.isArray(c.categories) ? c.categories : []),
    JSON.stringify(Array.isArray(c.products) ? c.products : []),
    c.enabled === false ? 0 : 1);
  ok(res, db.prepare('SELECT * FROM coupons WHERE code=?').get(code), { created: true });
});

router.put('/coupons/:id', allowRoles('admin'), (req, res) => {
  const id = toNum(req.params.id);
  if (!db.prepare('SELECT id FROM coupons WHERE id=?').get(id)) return fail(res, 404, 'Coupon not found');
  const c = req.body || {};
  const code = String(c.code || '').trim().toUpperCase();
  if (!code || !/^[A-Z0-9_-]{3,32}$/.test(code)) return fail(res, 400, 'Coupon code must be 3–32 letters/numbers.');
  db.prepare('UPDATE coupons SET code=?, type=?, value=?, min_order=?, max_discount=?, start_date=?, end_date=?, usage_limit=?, categories_json=?, products_json=?, enabled=? WHERE id=?').run(
    code,
    ['percent', 'fixed'].includes(c.type) ? c.type : 'percent',
    toNum(c.value, 1), toNum(c.minOrder, 0), toNum(c.maxDiscount, 0),
    String(c.startDate || ''), String(c.endDate || ''), toNum(c.usageLimit, 0),
    JSON.stringify(Array.isArray(c.categories) ? c.categories : []),
    JSON.stringify(Array.isArray(c.products) ? c.products : []),
    c.enabled === false ? 0 : 1, id);
  ok(res, db.prepare('SELECT * FROM coupons WHERE id=?').get(id), { updated: true });
});

router.delete('/coupons/:id', allowRoles('admin'), (req, res) => {
  db.prepare('DELETE FROM coupons WHERE id=?').run(toNum(req.params.id));
  ok(res, { deleted: true });
});

module.exports = router;