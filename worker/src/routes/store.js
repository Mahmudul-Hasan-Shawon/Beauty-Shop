import { HttpError } from '../router.js';
import { nowISO, round, toNum } from '../utils.js';

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

async function getSettings(db, key) {
  const row = await db.get('SELECT value FROM settings WHERE `key`=?', key);
  try { return row ? JSON.parse(row.value) : {}; } catch { return {}; }
}

async function calculateTotals(db, items, { paymentMethod, shippingRegion }) {
  const shippingCfg = await getSettings(db, 'shipping');
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  let shipping = 0;
  if (subtotal < toNum(shippingCfg?.freeThreshold, 2500)) {
    const fee = shippingRegion === 'outside'
      ? toNum(shippingCfg?.outsideFee, 120)
      : toNum(shippingCfg?.insideFee, 60);
    shipping = fee;
  }
  const taxCfg = await getSettings(db, 'tax');
  const tax = taxCfg?.enabled
    ? round(subtotal * (toNum(taxCfg.rate, 0) / 100))
    : 0;
  return { subtotal: round(subtotal), shipping: round(shipping), tax: round(tax) };
}

export function mount(router) {
  router.post('/api/checkout', async (r, app) => {
    const b = r.body || {};
    const customerKey = r.customerKey || String(b.customerKey || 'guest').slice(0, 64);
    const items = Array.isArray(b.items) ? b.items.slice(0, 50) : [];
    if (!items.length) throw new HttpError(400, 'Your cart is empty.');
    const name = String(b.name || '').trim();
    const phone = String(b.phone || '').trim();
    const address = String(b.address || '').trim();
    if (!name || !phone) throw new HttpError(400, 'Name and phone are required.');
    if (!/^[0-9+\-\s]{8,16}$/.test(phone)) throw new HttpError(400, 'Enter a valid phone number.');

    const orderItems = [];
    for (const it of items) {
      const product = await app.db.get('SELECT * FROM products WHERE id=?', Number(it.productId) || 0);
      if (!product) continue;
      const qty = Math.min(99, Math.max(1, Math.floor(Number(it.qty) || 1)));
      let price = Number(it.price || product.sale_price || product.price || 0);
      price = Math.max(0, price);
      const variant = it.variant ? String(it.variant).slice(0, 120) : product.size || '';
      const image = it.image || product.thumbnail || '';
      orderItems.push({ product_id: product.id, sku: product.sku, title: product.title, variant, price, qty, image });
    }
    if (!orderItems.length) throw new HttpError(400, 'No valid products in your cart.');

    const ship = await calculateTotals(app.db, orderItems, { paymentMethod: b.paymentMethod, shippingRegion: b.shippingRegion });
    const subtotal = ship.subtotal;
    const shipping = ship.shipping;
    const tax = ship.tax;

    let couponDiscount = 0;
    let couponCode = String(b.couponCode || '').trim().toUpperCase();
    if (couponCode) {
      const cpn = await app.db.get('SELECT * FROM coupons WHERE code=?', couponCode);
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
        await app.db.run('UPDATE coupons SET used_count = used_count + 1 WHERE id=?', cpn.id);
      } else {
        couponCode = '';
      }
    }

    const paymentSettings = await getSettings(app.db, 'payment');
    const paymentMethods = (Array.isArray(paymentSettings.methods) ? paymentSettings.methods.filter((m) => m.enabled) : []);
    const methodOk = paymentMethods.some((m) => m.id === String(b.paymentMethod || ''));
    if (!methodOk) throw new HttpError(400, 'Please choose a valid payment method.');

    const discount = round(couponDiscount);
    const total = round(subtotal + shipping + tax - discount);

    const orderNo = `PR${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;
    const info = await app.db.run(`
      INSERT INTO orders (order_no, customer_name, phone, email, address, city, area, postal_code, notes,
        subtotal, discount, shipping, total, payment_method, payment_status, status, coupon_code, coupon_discount, customer_key)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, orderNo, name, phone, String(b.email || '').slice(0, 160), address.slice(0, 300),
      String(b.city || '').slice(0, 100), String(b.area || '').slice(0, 120), String(b.postalCode || '').slice(0, 20),
      String(b.notes || '').slice(0, 1000), subtotal, discount, shipping, total,
      String(b.paymentMethod), 'paid', 'pending', couponCode || '', couponDiscount, customerKey);

    for (const it of orderItems) {
      await app.db.run('INSERT INTO order_items (order_id, product_id, sku, title, variant, price, qty, image) VALUES (?,?,?,?,?,?,?,?)',
        info.lastInsertRowid, it.product_id, it.sku, it.title, it.variant, it.price, it.qty, it.image);
      await app.db.run('UPDATE products SET stock = MAX(0, stock - ?) WHERE id=?', it.qty, it.product_id);
    }
    if (b.email) {
      await app.db.run("INSERT INTO users (name, email, phone) VALUES (?,?,?) ON CONFLICT(phone) DO UPDATE SET name=excluded.name, email=excluded.email", name, String(b.email), phone);
    } else {
      await app.db.run("INSERT INTO users (name, phone) VALUES (?,?) ON CONFLICT(phone) DO UPDATE SET name=excluded.name", name, phone);
    }

    const order = await app.db.get('SELECT * FROM orders WHERE id=?', info.lastInsertRowid);
    return {
      success: true,
      data: { orderNo, orderId: info.lastInsertRowid, total, subtotal, shipping, tax, discount, message: 'Order placed successfully' },
      meta: { statusLabel: STATUS_LABEL[order.status] }
    };
  });

  router.get('/api/track', async (r, app) => {
    const q = String(r.query.q || '').trim();
    if (!q) throw new HttpError(400, 'Enter your Order ID or phone number.');
    const rows = await app.db.all('SELECT * FROM orders WHERE order_no LIKE @q OR phone LIKE @p ORDER BY id DESC LIMIT 5', { q: `%${q}%`, p: `%${q}%` });
    if (!rows.length) throw new HttpError(404, 'No order found with that Order ID or phone number. Please check and try again.');
    const orders = [];
    for (const o of rows) {
      orders.push({ ...o, statusLabel: STATUS_LABEL[o.status], items: await app.db.all('SELECT * FROM order_items WHERE order_id=?', o.id) });
    }
    return { success: true, data: orders };
  });

  router.get('/api/statuses', async () => ({ success: true, data: ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })) }));

  router.post('/api/orders/:orderNo/verify', async (r, app) => {
    const order = await app.db.get('SELECT * FROM orders WHERE order_no=?', String(r.params.orderNo || '').trim());
    if (!order) throw new HttpError(404, 'Order not found');
    return { success: true, data: { status: order.status, statusLabel: STATUS_LABEL[order.status], paymentStatus: order.payment_status } };
  });

  router.post('/api/reviews', async (r, app) => {
    const b = r.body || {};
    const productId = Number(b.productId) || 0;
    const rating = Math.min(5, Math.max(1, Math.floor(Number(b.rating) || 5)));
    const name = String(b.name || '').trim();
    const text = String(b.text || '').trim();
    if (!productId || !name || text.length < 4) throw new HttpError(400, 'Please provide a name and a review of at least a few words.');
    const product = await app.db.get('SELECT * FROM products WHERE id=?', productId);
    if (!product) throw new HttpError(404, 'Product not found');
    await app.db.run('INSERT INTO reviews (product_id, customer_name, rating, title, text, image, status) VALUES (?,?,?,?,?,?,?)',
      productId, name.slice(0, 100), rating, String(b.title || '').slice(0, 140), text.slice(0, 2000), String(b.image || '').slice(0, 300), 'pending');
    const agg = await app.db.get("SELECT AVG(rating) a, COUNT(*) c FROM reviews WHERE product_id=? AND status='approved'", productId);
    await app.db.run('UPDATE products SET rating=?, review_count=? WHERE id=?', round(agg.a ?? product.rating, 1), Number(agg.c), productId);
    return { success: true, data: { submitted: true, message: 'Thank you! Your review is awaiting moderation.' } };
  });

  router.post('/api/coupon/validate', async (r, app) => {
    const code = String(r.body?.code || '').trim().toUpperCase();
    const subtotal = toNum(r.body?.subtotal);
    if (!code) throw new HttpError(400, 'Enter a coupon code.');
    const cpn = await app.db.get('SELECT * FROM coupons WHERE code=?', code);
    const today = nowISO().slice(0, 10);
    if (!cpn || !cpn.enabled) throw new HttpError(404, 'This coupon is not valid.');
    if (cpn.start_date && cpn.start_date > today) throw new HttpError(400, 'This coupon has not started yet.');
    if (cpn.end_date && cpn.end_date < today) throw new HttpError(400, 'This coupon has expired.');
    if (cpn.usage_limit > 0 && cpn.used_count >= cpn.usage_limit) throw new HttpError(400, 'This coupon has reached its usage limit.');
    if (subtotal < toNum(cpn.min_order, 0)) throw new HttpError(400, `Add ${cpn.min_order - subtotal} more to use this coupon.`);
    let d = cpn.type === 'fixed' ? toNum(cpn.value) : round(subtotal * (toNum(cpn.value) / 100));
    if (toNum(cpn.max_discount) > 0) d = Math.min(d, toNum(cpn.max_discount));
    return {
      success: true,
      data: { code: cpn.code, type: cpn.type, value: cpn.value, discount: round(d), minOrder: cpn.min_order, label: cpn.type === 'fixed' ? `${cpn.value} off` : `${cpn.value}% off` }
    };
  });

  router.get('/api/wishlist', async (r, app) => {
    const key = r.customerKey || 'guest';
    const rows = await app.db.all(`
      SELECT w.product_id AS id, w.created_at AS saved_at, p.title, p.slug, p.thumbnail, p.price, p.sale_price,
        p.discount_pct, p.stock, b.name AS brand_name
      FROM wishlists w JOIN products p ON p.id = w.product_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE w.customer_key=? AND p.status='published' ORDER BY w.id DESC
    `, key);
    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        name: row.title,
        slug: row.slug,
        thumbnail: row.thumbnail,
        price: Number(row.price || 0),
        salePrice: Number(row.sale_price || row.price || 0),
        discount: Number(row.discount_pct || 0),
        inStock: Number(row.stock) > 0,
        brand: row.brand_name,
        savedAt: row.saved_at
      }))
    };
  });

  router.post('/api/wishlist', async (r, app) => {
    const key = r.customerKey || 'guest';
    const productId = Number(r.body?.productId) || 0;
    const product = await app.db.get('SELECT * FROM products WHERE id=?', productId);
    if (!product) throw new HttpError(404, 'Product not found');
    await app.db.run('INSERT OR IGNORE INTO wishlists (customer_key, product_id) VALUES (?,?)', key, productId);
    return { success: true, data: { added: true } };
  });

  router.delete('/api/wishlist/:productId', async (r, app) => {
    const key = r.customerKey || 'guest';
    await app.db.run('DELETE FROM wishlists WHERE customer_key=? AND product_id=?', key, Number(r.params.productId) || 0);
    return { success: true, data: { removed: true } };
  });
}