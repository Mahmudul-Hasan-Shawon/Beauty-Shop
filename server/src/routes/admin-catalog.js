const express = require('express');
const db = require('../db');
const { requireAuth, allowRoles } = require('../auth');
const { shapeProduct, parseJson } = require('../catalog');
const { ok, fail, slugify, toNum, clampRating, nowISO, asyncHandler } = require('../utils');

const router = express.Router();
router.use(requireAuth);

function uniqueSlug(table, slug, id) {
  let s = slug || 'item';
  let i = 1;
  while (db.prepare(`SELECT id FROM ${table} WHERE slug=? AND id<>?`).get(s, id || 0)) s = `${slug}-${i++}`;
  return s;
}
function uniqueSku(sku, id) {
  let s = sku || 'SKU-' + Date.now().toString(36).toUpperCase();
  let i = 1;
  while (db.prepare('SELECT id FROM products WHERE sku=? AND id<>?').get(s, id || 0)) s = `${sku}-${i++}`;
  return s;
}

function productRow(id) {
  const row = db.prepare(`
    SELECT p.*, b.name AS brand_name, b.slug AS brand_slug, c.name AS category_name, c.slug AS category_slug
    FROM products p LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN categories c ON c.id=p.category_id
    WHERE p.id=?
  `).get(id);
  if (!row) return null;
  const variants = db.prepare('SELECT * FROM variants WHERE product_id=? ORDER BY id').all(id);
  return shapeProduct({ ...row, variants });
}

function productPayload(p) {
  return {
    sku: String(p.sku || '').trim() || null,
    title: String(p.title || '').trim() || null,
    brand_id: toNum(p.brand_id) || null,
    category_id: toNum(p.category_id) || null,
    main_category: String(p.mainCategory || p.main_category || 'Skincare').trim(),
    product_type: String(p.productType || p.product_type || '').trim(),
    size: String(p.size || '').trim(),
    description: String(p.description || ''),
    short_description: String(p.shortDescription || p.short_description || ''),
    price: toNum(p.price, 0),
    sale_price: toNum(p.salePrice !== undefined ? p.salePrice : p.sale_price, toNum(p.price, 0)),
    discount_pct: toNum(p.discount, toNum(p.discount_pct, 0)),
    stock: toNum(p.stock, Math.max(0, toNum(p.stock, 0))),
    status: ['published', 'draft', 'hidden'].includes(p.status) ? p.status : 'published',
    featured: p.featured ? 1 : 0,
    best_seller: p.bestSeller ? 1 : 0,
    new_arrival: p.newArrival ? 1 : 0,
    trending: p.trending ? 1 : 0,
    on_sale: p.onSale !== undefined ? (p.onSale ? 1 : 0) : (toNum(p.discount, 0) > 0 ? 1 : 1),
    rating: clampRating(p.rating || 4.5),
    review_count: toNum(p.reviewCount, 0),
    tags_json: JSON.stringify(Array.isArray(p.tags) ? p.tags : []),
    ingredients_json: JSON.stringify(Array.isArray(p.ingredients) ? p.ingredients : []),
    benefits_json: JSON.stringify(Array.isArray(p.benefits) ? p.benefits : []),
    how_to_use: String(p.howToUse || ''),
    skin_types_json: JSON.stringify(Array.isArray(p.skinTypes) ? p.skinTypes : []),
    concerns_json: JSON.stringify(Array.isArray(p.concerns) ? p.concerns : []),
    images_json: JSON.stringify(Array.isArray(p.images) ? p.images.filter(Boolean) : []),
    thumbnail: String(p.thumbnail || (Array.isArray(p.images) && p.images[0]) || ''),
    seo_title: String(p.seoTitle || ''),
    seo_description: String(p.seoDescription || '')
  };
}

// ---------------- Products ----------------
router.get('/products', (req, res) => {
  const q = String(req.query.q || '').trim();
  const category_id = toNum(req.query.category_id) || null;
  const brand_id = toNum(req.query.brand_id) || null;
  const status = String(req.query.status || '').trim();
  const featured = String(req.query.featured || '').trim();
  const sort = String(req.query.sort || 'id-desc');
  const page = Math.max(1, toNum(req.query.page, 1));
  const perPage = Math.min(50, Math.max(1, toNum(req.query.perPage, 20)));

  const where = ['1=1'];
  const params = {};
  if (q) { where.push('(p.title LIKE @q OR p.sku LIKE @q)'); params.q = `%${q}%`; }
  if (category_id) { where.push('p.category_id=@cat'); params.cat = category_id; }
  if (brand_id) { where.push('p.brand_id=@br'); params.br = brand_id; }
  if (status) { where.push('p.status=@st'); params.st = status; }
  if (featured === '1') where.push('p.featured=1');

  const sortMap = {
    'id-desc': 'p.id DESC',
    'id-asc': 'p.id ASC',
    'title-asc': 'p.title ASC',
    'title-desc': 'p.title DESC',
    price: 'p.sale_price ASC',
    'price-desc': 'p.sale_price DESC',
    stock: 'p.stock ASC',
    'created-desc': 'p.created_at DESC',
    updated: 'p.updated_at DESC'
  };
  const total = db.prepare(`SELECT COUNT(*) c FROM products p WHERE ${where.join(' AND ')}`).get(params).c;
  const rows = db.prepare(`
    SELECT p.*, b.name AS brand_name, c.name AS category_name
    FROM products p LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN categories c ON c.id=p.category_id
    WHERE ${where.join(' AND ')} ORDER BY ${sortMap[sort] || sortMap['id-desc']} LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: perPage, offset: (page - 1) * perPage });

  ok(res, rows.map((r) => ({
    ...r,
    images: parseJson(r.images_json),
    price: Number(r.price || 0),
    sale_price: Number(r.sale_price || 0),
    hasDiscount: Number(r.discount_pct) > 0
  })), { total, page, perPage, pages: Math.ceil(total / perPage) });
});

router.get('/products/:id', (req, res) => {
  const product = productRow(toNum(req.params.id));
  if (!product) return fail(res, 404, 'Product not found');
  ok(res, product);
});

router.post('/products', allowRoles('admin', 'editor'), (req, res) => {
  const p = req.body || {};
  const payload = productPayload(p);
  if (!payload.title) return fail(res, 400, 'Product title is required.');
  payload.sku = uniqueSku(payload.sku);
  const slug = uniqueSlug('products', slugify(payload.title));
  const price = Math.max(0, payload.sale_price || payload.price);
  const sale = payload.sale_price > 0 ? payload.sale_price : price;
  const discount = payload.discount_pct || Math.round(((price - sale) / (price || 1)) * 100);
  const images = parseJson(payload.images_json);
  const info = db.prepare(`
    INSERT INTO products (sku, title, slug, brand_id, category_id, main_category, product_type, size,
      description, short_description, price, sale_price, discount_pct, stock, status, featured,
      best_seller, new_arrival, trending, on_sale, rating, review_count, tags_json, ingredients_json,
      benefits_json, how_to_use, skin_types_json, concerns_json, images_json, thumbnail, seo_title, seo_description)
    VALUES (@sku, @title, @slug, @brand_id, @category_id, @main_category, @product_type, @size,
      @description, @short_description, @price, @sale_price, @discount_pct, @stock, @status, @featured,
      @best_seller, @new_arrival, @trending, @on_sale, @rating, @review_count, @tags_json, @ingredients_json,
      @benefits_json, @how_to_use, @skin_types_json, @concerns_json, @images_json, @thumbnail, @seo_title, @seo_description)
  `).run({ ...payload, price, sale_price: sale, discount_pct: discount, slug, thumbnail: payload.thumbnail || images[0] || '' });

  (Array.isArray(p.variants) ? p.variants : []).forEach((v, i) => {
    if (!String(v.size || '').trim() && i === 0 && payload.size) v.size = payload.size;
    if (!String(v.size || '').trim() && !payload.size) return;
    db.prepare('INSERT INTO variants (product_id, sku, size, price, old_price, stock, image) VALUES (?,?,?,?,?,?,?)').run(
      info.lastInsertRowid,
      String(v.sku || `${payload.sku}-${i + 1}`),
      String(v.size || ''),
      toNum(v.price, sale),
      toNum(v.oldPrice || v.old_price, price),
      toNum(v.stock, payload.stock),
      String(v.image || images[0] || '')
    );
  });

  ok(res, productRow(info.lastInsertRowid), { created: true });
});

router.put('/products/:id', allowRoles('admin', 'editor'), (req, res) => {
  const id = toNum(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id=?').get(id);
  if (!existing) return fail(res, 404, 'Product not found');
  const p = req.body || {};
  const payload = productPayload({ ...p });
  if (!payload.title) return fail(res, 400, 'Product title is required.');
  if (!p.sku || !String(p.sku).trim()) payload.sku = existing.sku;
  else payload.sku = uniqueSku(String(p.sku).trim(), id);
  const slug = uniqueSlug('products', slugify(payload.title), id);
  const price = Math.max(0, payload.price >= 0 ? payload.price : existing.price);
  const sale = payload.sale_price > 0 ? payload.sale_price : price;
  const discount = payload.discount_pct || Math.round(((price - sale) / (price || 1)) * 100);
  const images = parseJson(payload.images_json);

  db.prepare(`
    UPDATE products SET sku=@sku, title=@title, slug=@slug, brand_id=@brand_id, category_id=@category_id,
      main_category=@main_category, product_type=@product_type, size=@size, description=@description,
      short_description=@short_description, price=@price, sale_price=@sale_price, discount_pct=@discount_pct,
      stock=@stock, status=@status, featured=@featured, best_seller=@best_seller, new_arrival=@new_arrival,
      trending=@trending, on_sale=@on_sale, rating=@rating, review_count=@review_count, tags_json=@tags_json,
      ingredients_json=@ingredients_json, benefits_json=@benefits_json, how_to_use=@how_to_use,
      skin_types_json=@skin_types_json, concerns_json=@concerns_json, images_json=@images_json,
      thumbnail=@thumbnail, seo_title=@seo_title, seo_description=@seo_description, updated_at=@updated_at
    WHERE id=@id
  `).run({
    ...payload,
    sku: payload.sku, slug, price, sale_price: sale, discount_pct: discount,
    thumbnail: payload.thumbnail || images[0] || existing.thumbnail,
    updated_at: nowISO(), id
  });

  db.prepare('DELETE FROM variants WHERE product_id=?').run(id);
  (Array.isArray(p.variants) ? p.variants : []).forEach((v, i) => {
    if (!String(v.size || '').trim() && i === 0 && payload.size) v.size = payload.size;
    if (!String(v.size || '').trim() && !payload.size) return;
    db.prepare('INSERT INTO variants (product_id, sku, size, price, old_price, stock, image) VALUES (?,?,?,?,?,?,?)').run(
      id, String(v.sku || `${payload.sku}-${i + 1}`), String(v.size || ''),
      toNum(v.price, sale), toNum(v.oldPrice || v.old_price, price), toNum(v.stock, payload.stock),
      String(v.image || images[0] || '')
    );
  });

  ok(res, productRow(id), { updated: true });
});

router.delete('/products/:id', allowRoles('admin'), (req, res) => {
  const id = toNum(req.params.id);
  db.prepare('DELETE FROM products WHERE id=?').run(id);
  ok(res, { deleted: true });
});

router.post('/products/:id/duplicate', allowRoles('admin', 'editor'), (req, res) => {
  const id = toNum(req.params.id);
  const p = productRow(id);
  if (!p) return fail(res, 404, 'Product not found');
  const payload = productPayload(p);
  payload.title = `${p.name} (Copy)`;
  payload.sku = uniqueSku(`${p.sku}-COPY`);
  const slug = uniqueSlug('products', `${p.slug}-copy`);
  const info = db.prepare(`
    INSERT INTO products (sku, title, slug, brand_id, category_id, main_category, product_type, size,
      description, short_description, price, sale_price, discount_pct, stock, status, featured,
      best_seller, new_arrival, trending, on_sale, rating, review_count, tags_json, ingredients_json,
      benefits_json, how_to_use, skin_types_json, concerns_json, images_json, thumbnail, seo_title, seo_description)
    VALUES (@sku, @title, @slug, @brand_id, @category_id, @main_category, @product_type, @size,
      @description, @short_description, @price, @sale_price, @discount_pct, @stock, 'draft', 0, 0, 0, 0, 1,
      @rating, @review_count, @tags_json, @ingredients_json, @benefits_json, @how_to_use,
      @skin_types_json, @concerns_json, @images_json, @thumbnail, @seo_title, @seo_description)
  `).run({ ...payload, sku: payload.sku, slug });
  (p.variants || []).forEach((v) => {
    db.prepare('INSERT INTO variants (product_id, sku, size, price, old_price, stock, image) VALUES (?,?,?,?,?,?,?)').run(
      info.lastInsertRowid, v.sku, v.size, v.price, v.oldPrice, v.stock, v.image
    );
  });
  ok(res, productRow(info.lastInsertRowid), { duplicated: true });
});

router.patch('/products/:id/flags', allowRoles('admin', 'editor'), (req, res) => {
  const id = toNum(req.params.id);
  const allowed = ['status', 'featured', 'best_seller', 'new_arrival', 'trending', 'on_sale', 'stock'];
  const sets = [];
  const params = { id };
  for (const key of allowed) {
    if (key in (req.body || {})) {
      sets.push(`${key}=@${key}`);
      params[key] = typeof req.body[key] === 'boolean' ? (req.body[key] ? 1 : 0) : Math.max(0, toNum(req.body[key], 0));
    }
  }
  if (!sets.length) return fail(res, 400, 'Nothing to update.');
  sets.push('updated_at=@updated_at');
  params.updated_at = nowISO();
  db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id=@id`).run(params);
  ok(res, productRow(id), { updated: true });
});

router.post('/products/bulk', allowRoles('admin'), (req, res) => {
  const { ids = [], action, value } = req.body || {};
  const list = (Array.isArray(ids) ? ids : []).map(Number).filter(Boolean);
  if (!list.length) return fail(res, 400, 'Select at least one product.');
  const ph = list.map(() => '?').join(',');
  const actions = {
    delete: () => db.prepare(`DELETE FROM products WHERE id IN (${ph})`).run(...list),
    publish: () => db.prepare(`UPDATE products SET status='published', updated_at=@u WHERE id IN (${ph})`).run(...list, { u: nowISO() }),
    unpublish: () => db.prepare(`UPDATE products SET status='draft', updated_at=@u WHERE id IN (${ph})`).run(...list, { u: nowISO() }),
    featured: () => db.prepare(`UPDATE products SET featured=@v, updated_at=@u WHERE id IN (${ph})`).run(...list, { v: value ? 1 : 0, u: nowISO() }),
    category: () => db.prepare(`UPDATE products SET category_id=@v, updated_at=@u WHERE id IN (${ph})`).run(...list, { v: toNum(value) || null, u: nowISO() })
  };
  (actions[action] || actions.publish)();
  ok(res, { done: true });
});

// ---------------- Categories ----------------
router.get('/categories', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id) AS productCount
    FROM categories c ORDER BY c.sort_order, c.id
  `).all();
  ok(res, rows.map((r) => ({ ...r, productCount: Number(r.productCount) })));
});

router.post('/categories', allowRoles('admin', 'editor'), (req, res) => {
  const { name, description, image, sort_order, featured } = req.body || {};
  if (!String(name || '').trim()) return fail(res, 400, 'Category name is required.');
  const slug = uniqueSlug('categories', slugify(name));
  const info = db.prepare('INSERT INTO categories (name, slug, description, image, sort_order, featured) VALUES (?,?,?,?,?,?)').run(
    String(name).trim(), slug, String(description || ''), String(image || ''),
    Math.max(0, toNum(sort_order, 0)), featured ? 1 : 0
  );
  ok(res, db.prepare('SELECT * FROM categories WHERE id=?').get(info.lastInsertRowid), { created: true });
});

router.put('/categories/:id', allowRoles('admin', 'editor'), (req, res) => {
  const id = toNum(req.params.id);
  const existing = db.prepare('SELECT * FROM categories WHERE id=?').get(id);
  if (!existing) return fail(res, 404, 'Category not found');
  const { name, description, image, sort_order, featured, enabled } = req.body || {};
  const slug = uniqueSlug('categories', slugify(name || existing.name), id);
  db.prepare('UPDATE categories SET name=?, slug=?, description=?, image=?, sort_order=?, featured=?, enabled=? WHERE id=?').run(
    String(name || existing.name).trim(), slug, String(description ?? existing.description), String(image ?? existing.image),
    sort_order !== undefined ? toNum(sort_order) : existing.sort_order,
    featured !== undefined ? (featured ? 1 : 0) : existing.featured,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    id
  );
  ok(res, db.prepare('SELECT * FROM categories WHERE id=?').get(id), { updated: true });
});

router.delete('/categories/:id', allowRoles('admin'), (req, res) => {
  db.prepare('DELETE FROM categories WHERE id=?').run(toNum(req.params.id));
  ok(res, { deleted: true });
});

router.put('/categories/reorder', allowRoles('admin', 'editor'), (req, res) => {
  (req.body?.order || []).forEach((id, i) => {
    db.prepare('UPDATE categories SET sort_order=? WHERE id=?').run(i + 1, toNum(id));
  });
  ok(res, { saved: true });
});

// ---------------- Brands ----------------
router.get('/brands', (req, res) => {
  const rows = db.prepare(`
    SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id=b.id) AS productCount
    FROM brands b ORDER BY b.name
  `).all();
  ok(res, rows.map((r) => ({ ...r, productCount: Number(r.productCount) })));
});

router.post('/brands', allowRoles('admin', 'editor'), (req, res) => {
  const { name, description, image, featured } = req.body || {};
  if (!String(name || '').trim()) return fail(res, 400, 'Brand name is required.');
  const slug = uniqueSlug('brands', slugify(name));
  const info = db.prepare('INSERT INTO brands (name, slug, description, image, featured) VALUES (?,?,?,?,?)').run(
    String(name).trim(), slug, String(description || ''), String(image || ''), featured ? 1 : 0
  );
  ok(res, db.prepare('SELECT * FROM brands WHERE id=?').get(info.lastInsertRowid), { created: true });
});

router.put('/brands/:id', allowRoles('admin', 'editor'), (req, res) => {
  const id = toNum(req.params.id);
  const existing = db.prepare('SELECT * FROM brands WHERE id=?').get(id);
  if (!existing) return fail(res, 404, 'Brand not found');
  const { name, description, image, featured, enabled } = req.body || {};
  const slug = uniqueSlug('brands', slugify(name || existing.name), id);
  db.prepare('UPDATE brands SET name=?, slug=?, description=?, image=?, featured=?, enabled=? WHERE id=?').run(
    String(name || existing.name).trim(), slug, String(description ?? existing.description), String(image ?? existing.image),
    featured !== undefined ? (featured ? 1 : 0) : existing.featured,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    id
  );
  ok(res, db.prepare('SELECT * FROM brands WHERE id=?').get(id), { updated: true });
});

router.delete('/brands/:id', allowRoles('admin'), (req, res) => {
  db.prepare('DELETE FROM brands WHERE id=?').run(toNum(req.params.id));
  ok(res, { deleted: true });
});

module.exports = router;
module.exports.productPayload = productPayload;