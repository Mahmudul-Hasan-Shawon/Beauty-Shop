const express = require('express');
const db = require('../db');
const { ok, fail, round, toNum, nowISO } = require('../utils');
const { parseJson } = require('../catalog');

const router = express.Router();

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

function getSettings(key) {
  const row = db.prepare('SELECT value FROM settings WHERE `key`=?').get(key);
  try { return row ? JSON.parse(row.value) : {}; } catch { return {}; }
}

function calculateTotals(items, { paymentMethod, shippingRegion }) {
  const shippingCfg = getSettings('shipping');
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  let shipping = 0;
  if (subtotal < (toNum(shippingCfg?.freeThreshold, 2500))) {
    const fee = shippingRegion === 'outside'
      ? toNum(shippingCfg?.outsideFee, 120)
      : toNum(shippingCfg?.insideFee, 60);
    shipping = fee;
  }
  const taxCfg = getSettings('tax');
  const tax = taxCfg?.enabled

    ? round(subtotal * (toNum(taxCfg.rate, 0) / 100))
    : 0;
  return { subtotal: round(subtotal), shipping: round(shipping), tax: round(tax) };
}

router.post('/checkout', (req, res) => {
  const b = req.body || {};
  const customerKey = req.headers['x-customer'] || String(b.customerKey || 'guest').slice(0, 64);
  const items = Array.isArray(b.items) ? b.items.slice(0, 50) : [];
  if (!items.length) return fail(res, 400, 'Your cart is empty.');
  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').trim();
  const address = String(b.address || '').trim();
  if (!name || !phone) return fail(res, 400, 'Name and phone are required.');
  if (!/^[0-9+\-\s]{8,16}$/.test(phone)) return fail(res, 400, 'Enter a valid phone number.');

  const orderItems = [];
  for (const it of items) {
    const product = db.prepare('SELECT * FROM products WHERE id=?').get(Number(it.productId) || 0);
    if (!product) continue;
    const qty = Math.min(99, Math.max(1, Math.floor(Number(it.qty) || 1)));
    let price = Number(it.price || product.sale_price || product.price || 0);
    price = Math.max(0, price);
    const variant = it.variant ? String(it.variant).slice(0, 120) : product.size || '';
    const image = it.image || product.thumbnail || '';
    orderItems.push({
      product_id: product.id, sku: product.sku, title: product.title,
      variant, price, qty, image
    });
  }
  if (!orderItems.length) return fail(res, 400, 'No valid products in your cart.');

  const ship = calculateTotals(orderItems, {
    paymentMethod: b.paymentMethod, shippingRegion: b.shippingRegion
  });
  const subtotal = ship.subtotal;
  const shipping = ship.shipping;
  const tax = ship.tax;

  let couponDiscount = 0;
  let couponCode = String(b.couponCode || '').trim().toUpperCase();
  if (couponCode) {
    const cpn = db.prepare('SELECT * FROM coupons WHERE code=?').get(couponCode);
    const today = nowISO().slice(0, 10);
    const valid = cpn && cpn.enabled &&
      (!cpn.start_date || cpn.start_date <= today) &&
      (!cpn.end_date || cpn.end_date >= today) &&
      (cpn.usage_limit <= 0 || cpn.used_count < cpn.usage_limit) &&
      subtotal >= toNum(cpn.min_order, 0);
    if (valid) {
      let d = cpn.type === 'fixed' ? toNum(cpn.value) : round(subtotal * (toNum(cpn.value) / 100));
      if (toNum(cpn.max_discount) > 0) d = Math.min(d, toNum(cpn.max_discount));
      couponDiscount = round(d);
      db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id=?').run(cpn.id);
    } else {
      couponCode = '';
    }
  }

  const paymentMethods = getSettings('payment').methods.filter((m) => m.enabled);
  const methodOk = paymentMethods.some((m) => m.id === String(b.paymentMethod || ''));
  if (!methodOk) return fail(res, 400, 'Please choose a valid payment method.');

  const discount = round(couponDiscount);
  const total = round(subtotal + shipping + tax - discount);

  const orderNo = `PR${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;
  const create = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO orders (order_no, customer_name, phone, email, address, city, area, postal_code, notes,
        subtotal, discount, shipping, total, payment_method, payment_status, status, coupon_code, coupon_discount, customer_key)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(orderNo, name, phone, String(b.email || '').slice(0, 160), address.slice(0, 300),
      String(b.city || '').slice(0, 100), String(b.area || '').slice(0, 120), String(b.postalCode || '').slice(0, 20),
      String(b.notes || '').slice(0, 1000), subtotal, discount, shipping, total,
      String(b.paymentMethod), 'paid', 'pending', couponCode || '', couponDiscount, customerKey);
    const oiStmt = db.prepare('INSERT INTO order_items (order_id, product_id, sku, title, variant, price, qty, image) VALUES (?,?,?,?,?,?,?,?)');
    for (const it of orderItems) {
      oiStmt.run(info.lastInsertRowid, it.product_id, it.sku, it.title, it.variant, it.price, it.qty, it.image);
      db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id=?').run(it.qty, it.product_id);
    }
    if (b.email) {
      db.prepare("INSERT INTO users (name, email, phone) VALUES (?,?,?) ON CONFLICT(phone) DO UPDATE SET name=excluded.name, email=excluded.email").run(name, String(b.email), phone);
    } else {
      db.prepare("INSERT INTO users (name, phone) VALUES (?,?) ON CONFLICT(phone) DO UPDATE SET name=excluded.name").run(name, phone);
    }
    return info.lastInsertRowid;
  });

  const orderId = create();
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
  ok(res, { orderNo, orderId, total, subtotal, shipping, tax, discount, message: 'Order placed successfully' }, {
    statusLabel: STATUS_LABEL[order.status]
  });
});

router.get('/track', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return fail(res, 400, 'Enter your Order ID or phone number.');
  const rows = db.prepare('SELECT * FROM orders WHERE order_no LIKE @q OR phone LIKE @p ORDER BY id DESC LIMIT 5')
    .all({ q: `%${q}%`, p: `%${q}%` });
  if (!rows.length) return fail(res, 404, 'No order found with that Order ID or phone number. Please check and try again.');
  const orders = rows.map((o) => ({
    ...o,
    statusLabel: STATUS_LABEL[o.status],
    items: db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id)
  }));
  ok(res, orders);
});

router.get('/statuses', (req, res) => {
  ok(res, ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })));
});

router.post('/orders/:orderNo/verify', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_no=?').get(String(req.params.orderNo || '').trim());
  if (!order) return fail(res, 404, 'Order not found');
  ok(res, { status: order.status, statusLabel: STATUS_LABEL[order.status], paymentStatus: order.payment_status });
});

router.post('/reviews', (req, res) => {
  const b = req.body || {};
  const productId = Number(b.productId) || 0;
  const rating = Math.min(5, Math.max(1, Math.floor(Number(b.rating) || 5)));
  const name = String(b.name || '').trim();
  const text = String(b.text || '').trim();
  if (!productId || !name || text.length < 4) return fail(res, 400, 'Please provide a name and a review of at least a few words.');
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(productId);
  if (!product) return fail(res, 404, 'Product not found');
  db.prepare('INSERT INTO reviews (product_id, customer_name, rating, title, text, image, status) VALUES (?,?,?,?,?,?,?)').run(
    productId, name.slice(0, 100), rating, String(b.title || '').slice(0, 140), text.slice(0, 2000), String(b.image || '').slice(0, 300), 'pending'
  );
  const agg = db.prepare("SELECT AVG(rating) a, COUNT(*) c FROM reviews WHERE product_id=? AND status='approved'").get(productId);
  db.prepare('UPDATE products SET rating=?, review_count=? WHERE id=?').run(
    round(agg.a ?? product.rating, 1), Number(agg.c), productId
  );
  ok(res, { submitted: true, message: 'Thank you! Your review is awaiting moderation.' });
});

router.post('/coupon/validate', (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const subtotal = toNum(req.body?.subtotal);
  if (!code) return fail(res, 400, 'Enter a coupon code.');
  const cpn = db.prepare('SELECT * FROM coupons WHERE code=?').get(code);
  const today = nowISO().slice(0, 10);
  if (!cpn || !cpn.enabled) return fail(res, 404, 'This coupon is not valid.');
  if (cpn.start_date && cpn.start_date > today) return fail(res, 400, 'This coupon has not started yet.');
  if (cpn.end_date && cpn.end_date < today) return fail(res, 400, 'This coupon has expired.');
  if (cpn.usage_limit > 0 && cpn.used_count >= cpn.usage_limit) return fail(res, 400, 'This coupon has reached its usage limit.');
  if (subtotal < toNum(cpn.min_order, 0)) return fail(res, 400, `Add ${cpn.min_order - subtotal} more to use this coupon.`);
  let d = cpn.type === 'fixed' ? toNum(cpn.value) : round(subtotal * (toNum(cpn.value) / 100));
  if (toNum(cpn.max_discount) > 0) d = Math.min(d, toNum(cpn.max_discount));
  ok(res, {
    code: cpn.code, type: cpn.type, value: cpn.value, discount: round(d),
    minOrder: cpn.min_order, label: cpn.type === 'fixed' ? `${cpn.value} off` : `${cpn.value}% off`
  });
});

router.get('/wishlist', (req, res) => {
  const key = String(req.headers['x-customer'] || 'guest').slice(0, 64);
  const rows = db.prepare(`
    SELECT w.product_id AS id, w.created_at AS saved_at, p.title, p.slug, p.thumbnail, p.price, p.sale_price,
      p.discount_pct, p.stock, b.name AS brand_name
    FROM wishlists w JOIN products p ON p.id = w.product_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE w.customer_key=? AND p.status='published' ORDER BY w.id DESC
  `).all(key);
  ok(res, rows.map((r) => ({
    id: r.id,
    name: r.title,
    slug: r.slug,
    thumbnail: r.thumbnail,
    price: Number(r.price || 0),
    salePrice: Number(r.sale_price || r.price || 0),
    discount: Number(r.discount_pct || 0),
    inStock: Number(r.stock) > 0,
    brand: r.brand_name,
    savedAt: r.saved_at
  })));
});

router.post('/wishlist', (req, res) => {
  const key = String(req.headers['x-customer'] || 'guest').slice(0, 64);
  const productId = Number(req.body?.productId) || 0;
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(productId);
  if (!product) return fail(res, 404, 'Product not found');
  db.prepare('INSERT OR IGNORE INTO wishlists (customer_key, product_id) VALUES (?,?)').run(key, productId);
  ok(res, { added: true });
});

router.delete('/wishlist/:productId', (req, res) => {
  const key = String(req.headers['x-customer'] || 'guest').slice(0, 64);
  db.prepare('DELETE FROM wishlists WHERE customer_key=? AND product_id=?').run(key, Number(req.params.productId) || 0);
  ok(res, { removed: true });
});

module.exports = router;
module.exports.ORDER_STATUSES = ORDER_STATUSES;
module.exports.STATUS_LABEL = STATUS_LABEL;