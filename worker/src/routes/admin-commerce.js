import { HttpError } from '../router.js';
import { requireRole } from '../auth.js';
import { toNum, nowISO, round } from '../utils.js';

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
const STATUS_LABEL = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned'
};

export function mount(router) {
  // ---------------- Orders ----------------
  router.get('/api/admin/orders', async (r, app) => {
    await requireRole(r, app, []);
    const q = String(r.query.q || '').trim();
    const status = String(r.query.status || '').trim();
    const payment = String(r.query.payment || '').trim();
    const date = String(r.query.date || '').trim();
    const page = Math.max(1, toNum(r.query.page, 1));
    const perPage = Math.min(50, Math.max(1, toNum(r.query.perPage, 20)));
    const where = ['1=1'];
    const params = {};
    if (q) { where.push('(order_no LIKE @q OR customer_name LIKE @q OR phone LIKE @q)'); params.q = `%${q}%`; }
    if (status) { where.push('status=@st'); params.st = status; }
    if (payment) { where.push('payment_status=@pm'); params.pm = payment; }
    if (date) { where.push('date(created_at)=@d'); params.d = date; }
    const total = (await app.db.get(`SELECT COUNT(*) c FROM orders WHERE ${where.join(' AND ')}`, params)).c;
    const rows = await app.db.all(`SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT @limit OFFSET @offset`,
      { ...params, limit: perPage, offset: (page - 1) * perPage });
    return {
      success: true,
      data: rows.map((o) => ({ ...o, statusLabel: STATUS_LABEL[o.status] })),
      meta: { total, page, perPage, pages: Math.ceil(total / perPage) }
    };
  });

  router.get('/api/admin/orders/:id', async (r, app) => {
    const order = await app.db.get('SELECT * FROM orders WHERE id=?', toNum(r.params.id));
    if (!order) throw new HttpError(404, 'Order not found');
    const items = await app.db.all('SELECT * FROM order_items WHERE order_id=?', order.id);
    return {
      success: true,
      data: { ...order, statusLabel: STATUS_LABEL[order.status], items, statuses: ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })) }
    };
  });

  router.put('/api/admin/orders/:id', async (r, app) => {
    await requireRole(r, app, ['admin', 'order_manager']);
    const id = toNum(r.params.id);
    const order = await app.db.get('SELECT * FROM orders WHERE id=?', id);
    if (!order) throw new HttpError(404, 'Order not found');
    const b = r.body || {};
    const nextStatus = String(b.status || order.status).toLowerCase();
    if (!ORDER_STATUSES.includes(nextStatus)) throw new HttpError(400, 'Invalid order status.');
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
      updated_at: nowISO(),
      id
    };
    await app.db.run(`
      UPDATE orders SET status=@status, payment_status=@payment_status, tracking_no=@tracking_no,
        admin_note=@admin_note, notes=@notes, address=@address, city=@city, area=@area,
        postal_code=@postal_code, updated_at=@updated_at WHERE id=@id
    `, overrides);
    const updated = await app.db.get('SELECT * FROM orders WHERE id=?', id);
    return {
      success: true,
      data: { ...updated, statusLabel: STATUS_LABEL[nextStatus] },
      meta: { updated: true, notify: ['shipped', 'delivered', 'cancelled'].includes(nextStatus) }
    };
  });

  router.delete('/api/admin/orders/:id', async (r, app) => {
    await requireRole(r, app, ['admin']);
    await app.db.run('DELETE FROM orders WHERE id=?', toNum(r.params.id));
    return { success: true, data: { deleted: true } };
  });

  // ---------------- Customers ----------------
  router.get('/api/admin/customers', async (r, app) => {
    await requireRole(r, app, []);
    const q = String(r.query.q || '').trim();
    const where = ['1=1'];
    const params = {};
    if (q) { where.push('(name LIKE @q OR phone LIKE @q OR email LIKE @q)'); params.q = `%${q}%`; }
    const rows = await app.db.all(`
      SELECT u.*,
        (SELECT COUNT(*) FROM orders o WHERE o.phone=u.phone) AS orderCount,
        (SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.phone=u.phone AND o.status NOT IN ('cancelled','returned')) AS totalSpent,
        (SELECT MAX(o.created_at) FROM orders o WHERE o.phone=u.phone) AS lastOrder
      FROM users u WHERE ${where.join(' AND ')} ORDER BY u.id DESC
    `, params);
    return { success: true, data: rows.map((row) => ({ ...row, totalSpent: round(Number(row.totalSpent) || 0) })) };
  });

  router.get('/api/admin/customers/:id', async (r, app) => {
    await requireRole(r, app, []);
    const u = await app.db.get('SELECT * FROM users WHERE id=?', toNum(r.params.id));
    if (!u) throw new HttpError(404, 'Customer not found');
    const orders = await app.db.all('SELECT * FROM orders WHERE phone=? ORDER BY id DESC LIMIT 50', u.phone);
    const out = [];
    for (const o of orders) {
      out.push({ ...o, statusLabel: STATUS_LABEL[o.status], items: await app.db.all('SELECT * FROM order_items WHERE order_id=?', o.id) });
    }
    return { success: true, data: { ...u, orders: out } };
  });

  // ---------------- Reviews ----------------
  router.get('/api/admin/reviews', async (r, app) => {
    await requireRole(r, app, []);
    const status = String(r.query.status || '').trim();
    const q = String(r.query.q || '').trim();
    const where = ['1=1'];
    const params = {};
    if (status) { where.push('r.status=@st'); params.st = status; }
    if (q) { where.push('(r.customer_name LIKE @q OR p.title LIKE @q)'); params.q = `%${q}%`; }
    const rows = await app.db.all(`
      SELECT r.*, p.title AS productName, p.slug AS productSlug
      FROM reviews r LEFT JOIN products p ON p.id=r.product_id
      WHERE ${where.join(' AND ')} ORDER BY r.id DESC LIMIT 200
    `, params);
    return { success: true, data: rows };
  });

  router.patch('/api/admin/reviews/:id', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor', 'order_manager']);
    const id = toNum(r.params.id);
    const existing = await app.db.get('SELECT * FROM reviews WHERE id=?', id);
    if (!existing) throw new HttpError(404, 'Review not found');
    const b = r.body || {};
    const allowed = ['status', 'featured', 'rating'];
    const sets = [];
    const params = { id };
    for (const k of allowed) {
      if (k in b) { sets.push(`${k}=@${k}`); params[k] = k === 'rating' ? Math.min(5, Math.max(1, toNum(b[k], 5))) : String(b[k]); }
    }
    if (sets.length) await app.db.run(`UPDATE reviews SET ${sets.join(', ')} WHERE id=@id`, params);
    const agg = await app.db.get("SELECT AVG(rating) a, COUNT(*) c FROM reviews WHERE product_id=? AND status='approved'", existing.product_id);
    await app.db.run('UPDATE products SET rating=?, review_count=? WHERE id=?', round(agg.a || existing.rating, 1), Number(agg.c), existing.product_id);
    return { success: true, data: await app.db.get('SELECT * FROM reviews WHERE id=?', id), meta: { updated: true } };
  });

  router.delete('/api/admin/reviews/:id', async (r, app) => {
    await requireRole(r, app, ['admin']);
    await app.db.run('DELETE FROM reviews WHERE id=?', toNum(r.params.id));
    return { success: true, data: { deleted: true } };
  });

  // ---------------- Coupons ----------------
  router.get('/api/admin/coupons', async (r, app) => {
    await requireRole(r, app, []);
    return { success: true, data: await app.db.all('SELECT * FROM coupons ORDER BY id DESC') };
  });

  router.post('/api/admin/coupons', async (r, app) => {
    await requireRole(r, app, ['admin']);
    const c = r.body || {};
    const code = String(c.code || '').trim().toUpperCase();
    if (!code || !/^[A-Z0-9_-]{3,32}$/.test(code)) throw new HttpError(400, 'Coupon code must be 3–32 letters/numbers.');
    if (await app.db.get('SELECT id FROM coupons WHERE code=?', code)) throw new HttpError(400, 'This coupon code already exists.');
    if (!['percent', 'fixed'].includes(c.type)) throw new HttpError(400, 'Invalid coupon type.');
    const value = toNum(c.value);
    if (value <= 0 || (c.type === 'percent' && value > 100)) throw new HttpError(400, 'Enter a valid coupon value.');
    await app.db.run(`
      INSERT INTO coupons (code, type, value, min_order, max_discount, start_date, end_date, usage_limit, categories_json, products_json, enabled)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `, code, c.type, value, toNum(c.minOrder, 0), toNum(c.maxDiscount, 0),
      String(c.startDate || ''), String(c.endDate || ''), toNum(c.usageLimit, 0),
      JSON.stringify(Array.isArray(c.categories) ? c.categories : []),
      JSON.stringify(Array.isArray(c.products) ? c.products : []),
      c.enabled === false ? 0 : 1);
    return { success: true, data: await app.db.get('SELECT * FROM coupons WHERE code=?', code), meta: { created: true } };
  });

  router.put('/api/admin/coupons/:id', async (r, app) => {
    await requireRole(r, app, ['admin']);
    const id = toNum(r.params.id);
    if (!(await app.db.get('SELECT id FROM coupons WHERE id=?', id))) throw new HttpError(404, 'Coupon not found');
    const c = r.body || {};
    const code = String(c.code || '').trim().toUpperCase();
    if (!code || !/^[A-Z0-9_-]{3,32}$/.test(code)) throw new HttpError(400, 'Coupon code must be 3–32 letters/numbers.');
    await app.db.run('UPDATE coupons SET code=?, type=?, value=?, min_order=?, max_discount=?, start_date=?, end_date=?, usage_limit=?, categories_json=?, products_json=?, enabled=? WHERE id=?',
      code, ['percent', 'fixed'].includes(c.type) ? c.type : 'percent',
      toNum(c.value, 1), toNum(c.minOrder, 0), toNum(c.maxDiscount, 0),
      String(c.startDate || ''), String(c.endDate || ''), toNum(c.usageLimit, 0),
      JSON.stringify(Array.isArray(c.categories) ? c.categories : []),
      JSON.stringify(Array.isArray(c.products) ? c.products : []),
      c.enabled === false ? 0 : 1, id);
    return { success: true, data: await app.db.get('SELECT * FROM coupons WHERE id=?', id), meta: { updated: true } };
  });

  router.delete('/api/admin/coupons/:id', async (r, app) => {
    await requireRole(r, app, ['admin']);
    await app.db.run('DELETE FROM coupons WHERE id=?', toNum(r.params.id));
    return { success: true, data: { deleted: true } };
  });
}