import { shapeProduct, parseJson } from '../catalog.js';
import { HttpError } from '../router.js';
import { requireRole } from '../auth.js';
import { slugify, toNum, clampRating, nowISO } from '../utils.js';

async function uniqueSlug(db, table, slug, id) {
  let s = slug || 'item';
  let i = 1;
  while (await db.get(`SELECT id FROM ${table} WHERE slug=? AND id<>?`, s, id || 0)) s = `${slug}-${i++}`;
  return s;
}

async function uniqueSku(db, sku, id) {
  let s = sku || 'SKU-' + Date.now().toString(36).toUpperCase();
  let i = 1;
  while (await db.get('SELECT id FROM products WHERE sku=? AND id<>?', s, id || 0)) s = `${sku}-${i++}`;
  return s;
}

async function productRow(db, id) {
  const row = await db.get(`
    SELECT p.*, b.name AS brand_name, b.slug AS brand_slug, c.name AS category_name, c.slug AS category_slug
    FROM products p LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN categories c ON c.id=p.category_id
    WHERE p.id=?
  `, id);
  if (!row) return null;
  const variants = await db.all('SELECT * FROM variants WHERE product_id=? ORDER BY id', id);
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

export function mount(router) {
  // ---------------- Products ----------------
  router.get('/api/admin/products', async (r, app) => {
    await requireRole(r, app, []);
    const q = String(r.query.q || '').trim();
    const category_id = toNum(r.query.category_id) || null;
    const brand_id = toNum(r.query.brand_id) || null;
    const status = String(r.query.status || '').trim();
    const featured = String(r.query.featured || '').trim();
    const sort = String(r.query.sort || 'id-desc');
    const page = Math.max(1, toNum(r.query.page, 1));
    const perPage = Math.min(50, Math.max(1, toNum(r.query.perPage, 20)));

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
    const total = (await app.db.get(`SELECT COUNT(*) c FROM products p WHERE ${where.join(' AND ')}`, params)).c;
    const rows = await app.db.all(`
      SELECT p.*, b.name AS brand_name, c.name AS category_name
      FROM products p LEFT JOIN brands b ON b.id=p.brand_id LEFT JOIN categories c ON c.id=p.category_id
      WHERE ${where.join(' AND ')} ORDER BY ${sortMap[sort] || sortMap['id-desc']} LIMIT @limit OFFSET @offset
    `, { ...params, limit: perPage, offset: (page - 1) * perPage });

    return {
      success: true,
      data: rows.map((row) => ({
        ...row,
        images: parseJson(row.images_json),
        price: Number(row.price || 0),
        sale_price: Number(row.sale_price || 0),
        hasDiscount: Number(row.discount_pct) > 0
      })),
      meta: { total, page, perPage, pages: Math.ceil(total / perPage) }
    };
  });

  router.get('/api/admin/products/:id', async (r, app) => {
    const product = await productRow(app.db, toNum(r.params.id));
    if (!product) throw new HttpError(404, 'Product not found');
    return { success: true, data: product };
  });

  router.post('/api/admin/products', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const p = r.body || {};
    const payload = productPayload(p);
    if (!payload.title) throw new HttpError(400, 'Product title is required.');
    payload.sku = await uniqueSku(app.db, payload.sku);
    const slug = await uniqueSlug(app.db, 'products', slugify(payload.title));
    const price = Math.max(0, payload.sale_price || payload.price);
    const sale = payload.sale_price > 0 ? payload.sale_price : price;
    const discount = payload.discount_pct || Math.round(((price - sale) / (price || 1)) * 100);
    const images = parseJson(payload.images_json);
    const info = await app.db.run(`
      INSERT INTO products (sku, title, slug, brand_id, category_id, main_category, product_type, size,
        description, short_description, price, sale_price, discount_pct, stock, status, featured,
        best_seller, new_arrival, trending, on_sale, rating, review_count, tags_json, ingredients_json,
        benefits_json, how_to_use, skin_types_json, concerns_json, images_json, thumbnail, seo_title, seo_description)
      VALUES (@sku, @title, @slug, @brand_id, @category_id, @main_category, @product_type, @size,
        @description, @short_description, @price, @sale_price, @discount_pct, @stock, @status, @featured,
        @best_seller, @new_arrival, @trending, @on_sale, @rating, @review_count, @tags_json, @ingredients_json,
        @benefits_json, @how_to_use, @skin_types_json, @concerns_json, @images_json, @thumbnail, @seo_title, @seo_description)
    `, { ...payload, price, sale_price: sale, discount_pct: discount, slug, thumbnail: payload.thumbnail || images[0] || '' });

    const variants = Array.isArray(p.variants) ? p.variants : [];
    for (let i = 0; i < variants.length; i++) {
      let v = variants[i];
      if (!String(v.size || '').trim() && i === 0 && payload.size) v = { ...v, size: payload.size };
      if (!String(v.size || '').trim() && !payload.size) continue;
      await app.db.run('INSERT INTO variants (product_id, sku, size, price, old_price, stock, image) VALUES (?,?,?,?,?,?,?)',
        info.lastInsertRowid, String(v.sku || `${payload.sku}-${i + 1}`), String(v.size || ''),
        toNum(v.price, sale), toNum(v.oldPrice || v.old_price, price), toNum(v.stock, payload.stock),
        String(v.image || images[0] || ''));
    }

    return { success: true, data: await productRow(app.db, info.lastInsertRowid), meta: { created: true } };
  });

  router.put('/api/admin/products/:id', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const id = toNum(r.params.id);
    const existing = await app.db.get('SELECT * FROM products WHERE id=?', id);
    if (!existing) throw new HttpError(404, 'Product not found');
    const p = r.body || {};
    const payload = productPayload({ ...p });
    if (!payload.title) throw new HttpError(400, 'Product title is required.');
    if (!p.sku || !String(p.sku).trim()) payload.sku = existing.sku;
    else payload.sku = await uniqueSku(app.db, String(p.sku).trim(), id);
    const slug = await uniqueSlug(app.db, 'products', slugify(payload.title), id);
    const price = Math.max(0, payload.price >= 0 ? payload.price : existing.price);
    const sale = payload.sale_price > 0 ? payload.sale_price : price;
    const discount = payload.discount_pct || Math.round(((price - sale) / (price || 1)) * 100);
    const images = parseJson(payload.images_json);

    await app.db.run(`
      UPDATE products SET sku=@sku, title=@title, slug=@slug, brand_id=@brand_id, category_id=@category_id,
        main_category=@main_category, product_type=@product_type, size=@size, description=@description,
        short_description=@short_description, price=@price, sale_price=@sale_price, discount_pct=@discount_pct,
        stock=@stock, status=@status, featured=@featured, best_seller=@best_seller, new_arrival=@new_arrival,
        trending=@trending, on_sale=@on_sale, rating=@rating, review_count=@review_count, tags_json=@tags_json,
        ingredients_json=@ingredients_json, benefits_json=@benefits_json, how_to_use=@how_to_use,
        skin_types_json=@skin_types_json, concerns_json=@concerns_json, images_json=@images_json,
        thumbnail=@thumbnail, seo_title=@seo_title, seo_description=@seo_description, updated_at=@updated_at
      WHERE id=@id
    `, {
      ...payload,
      slug, price, sale_price: sale, discount_pct: discount,
      thumbnail: payload.thumbnail || images[0] || existing.thumbnail,
      updated_at: nowISO(), id
    });

    await app.db.run('DELETE FROM variants WHERE product_id=?', id);
    const variants = Array.isArray(p.variants) ? p.variants : [];
    for (let i = 0; i < variants.length; i++) {
      let v = variants[i];
      if (!String(v.size || '').trim() && i === 0 && payload.size) v = { ...v, size: payload.size };
      if (!String(v.size || '').trim() && !payload.size) continue;
      await app.db.run('INSERT INTO variants (product_id, sku, size, price, old_price, stock, image) VALUES (?,?,?,?,?,?,?)',
        id, String(v.sku || `${payload.sku}-${i + 1}`), String(v.size || ''),
        toNum(v.price, sale), toNum(v.oldPrice || v.old_price, price), toNum(v.stock, payload.stock),
        String(v.image || images[0] || ''));
    }

    return { success: true, data: await productRow(app.db, id), meta: { updated: true } };
  });

  router.delete('/api/admin/products/:id', async (r, app) => {
    await requireRole(r, app, ['admin']);
    await app.db.run('DELETE FROM products WHERE id=?', toNum(r.params.id));
    return { success: true, data: { deleted: true } };
  });

  router.post('/api/admin/products/:id/duplicate', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const id = toNum(r.params.id);
    const p = await productRow(app.db, id);
    if (!p) throw new HttpError(404, 'Product not found');
    const payload = productPayload(p);
    payload.title = `${p.name} (Copy)`;
    payload.sku = await uniqueSku(app.db, `${p.sku}-COPY`);
    const slug = await uniqueSlug(app.db, 'products', `${p.slug}-copy`);
    const info = await app.db.run(`
      INSERT INTO products (sku, title, slug, brand_id, category_id, main_category, product_type, size,
        description, short_description, price, sale_price, discount_pct, stock, status, featured,
        best_seller, new_arrival, trending, on_sale, rating, review_count, tags_json, ingredients_json,
        benefits_json, how_to_use, skin_types_json, concerns_json, images_json, thumbnail, seo_title, seo_description)
      VALUES (@sku, @title, @slug, @brand_id, @category_id, @main_category, @product_type, @size,
        @description, @short_description, @price, @sale_price, @discount_pct, @stock, 'draft', 0, 0, 0, 0, 1,
        @rating, @review_count, @tags_json, @ingredients_json, @benefits_json, @how_to_use,
        @skin_types_json, @concerns_json, @images_json, @thumbnail, @seo_title, @seo_description)
    `, { ...payload, slug });
    for (const v of p.variants || []) {
      await app.db.run('INSERT INTO variants (product_id, sku, size, price, old_price, stock, image) VALUES (?,?,?,?,?,?,?)',
        info.lastInsertRowid, v.sku, v.size, v.price, v.oldPrice, v.stock, v.image);
    }
    return { success: true, data: await productRow(app.db, info.lastInsertRowid), meta: { duplicated: true } };
  });

  router.patch('/api/admin/products/:id/flags', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const id = toNum(r.params.id);
    const allowed = ['status', 'featured', 'best_seller', 'new_arrival', 'trending', 'on_sale', 'stock'];
    const sets = [];
    const params = { id };
    for (const key of allowed) {
      if (key in (r.body || {})) {
        sets.push(`${key}=@${key}`);
        params[key] = typeof r.body[key] === 'boolean' ? (r.body[key] ? 1 : 0) : Math.max(0, toNum(r.body[key], 0));
      }
    }
    if (!sets.length) throw new HttpError(400, 'Nothing to update.');
    sets.push('updated_at=@updated_at');
    params.updated_at = nowISO();
    await app.db.run(`UPDATE products SET ${sets.join(', ')} WHERE id=@id`, params);
    return { success: true, data: await productRow(app.db, id), meta: { updated: true } };
  });

  router.post('/api/admin/products/bulk', async (r, app) => {
    await requireRole(r, app, ['admin']);
    const { ids = [], action, value } = r.body || {};
    const list = (Array.isArray(ids) ? ids : []).map(Number).filter(Boolean);
    if (!list.length) throw new HttpError(400, 'Select at least one product.');
    const ph = list.map(() => '?').join(',');
    const args = [...list];
    switch (action) {
      case 'delete':
        await app.db.run(`DELETE FROM products WHERE id IN (${ph})`, ...args);
        break;
      case 'publish':
        args.push(nowISO());
        await app.db.run(`UPDATE products SET status='published', updated_at=? WHERE id IN (${ph})`, ...args);
        break;
      case 'unpublish':
        args.push(nowISO());
        await app.db.run(`UPDATE products SET status='draft', updated_at=? WHERE id IN (${ph})`, ...args);
        break;
      case 'featured':
        args.push(value ? 1 : 0, nowISO());
        await app.db.run(`UPDATE products SET featured=?, updated_at=? WHERE id IN (${ph})`, ...args);
        break;
      case 'category':
        args.push(toNum(value) || null, nowISO());
        await app.db.run(`UPDATE products SET category_id=?, updated_at=? WHERE id IN (${ph})`, ...args);
        break;
      default:
        args.push(nowISO());
        await app.db.run(`UPDATE products SET status='published', updated_at=? WHERE id IN (${ph})`, ...args);
    }
    return { success: true, data: { done: true } };
  });

  // ---------------- Categories ----------------
  router.get('/api/admin/categories', async (r, app) => {
    await requireRole(r, app, []);
    const rows = await app.db.all(`
      SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id) AS productCount
      FROM categories c ORDER BY c.sort_order, c.id
    `);
    return { success: true, data: rows.map((row) => ({ ...row, productCount: Number(row.productCount) })) };
  });

  router.post('/api/admin/categories', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const { name, description, image, sort_order, featured } = r.body || {};
    if (!String(name || '').trim()) throw new HttpError(400, 'Category name is required.');
    const slug = await uniqueSlug(app.db, 'categories', slugify(name));
    const info = await app.db.run('INSERT INTO categories (name, slug, description, image, sort_order, featured) VALUES (?,?,?,?,?,?)',
      String(name).trim(), slug, String(description || ''), String(image || ''),
      Math.max(0, toNum(sort_order, 0)), featured ? 1 : 0);
    return { success: true, data: await app.db.get('SELECT * FROM categories WHERE id=?', info.lastInsertRowid), meta: { created: true } };
  });

  router.put('/api/admin/categories/:id', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const id = toNum(r.params.id);
    const existing = await app.db.get('SELECT * FROM categories WHERE id=?', id);
    if (!existing) throw new HttpError(404, 'Category not found');
    const { name, description, image, sort_order, featured, enabled } = r.body || {};
    const slug = await uniqueSlug(app.db, 'categories', slugify(name || existing.name), id);
    await app.db.run('UPDATE categories SET name=?, slug=?, description=?, image=?, sort_order=?, featured=?, enabled=? WHERE id=?',
      String(name || existing.name).trim(), slug, String(description ?? existing.description), String(image ?? existing.image),
      sort_order !== undefined ? toNum(sort_order) : existing.sort_order,
      featured !== undefined ? (featured ? 1 : 0) : existing.featured,
      enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
      id);
    return { success: true, data: await app.db.get('SELECT * FROM categories WHERE id=?', id), meta: { updated: true } };
  });

  router.delete('/api/admin/categories/:id', async (r, app) => {
    await requireRole(r, app, ['admin']);
    await app.db.run('DELETE FROM categories WHERE id=?', toNum(r.params.id));
    return { success: true, data: { deleted: true } };
  });

  router.put('/api/admin/categories/reorder', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const order = r.body?.order || [];
    for (let i = 0; i < order.length; i++) {
      await app.db.run('UPDATE categories SET sort_order=? WHERE id=?', i + 1, toNum(order[i]));
    }
    return { success: true, data: { saved: true } };
  });

  // ---------------- Brands ----------------
  router.get('/api/admin/brands', async (r, app) => {
    await requireRole(r, app, []);
    const rows = await app.db.all(`
      SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id=b.id) AS productCount
      FROM brands b ORDER BY b.name
    `);
    return { success: true, data: rows.map((row) => ({ ...row, productCount: Number(row.productCount) })) };
  });

  router.post('/api/admin/brands', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const { name, description, image, featured } = r.body || {};
    if (!String(name || '').trim()) throw new HttpError(400, 'Brand name is required.');
    const slug = await uniqueSlug(app.db, 'brands', slugify(name));
    const info = await app.db.run('INSERT INTO brands (name, slug, description, image, featured) VALUES (?,?,?,?,?)',
      String(name).trim(), slug, String(description || ''), String(image || ''), featured ? 1 : 0);
    return { success: true, data: await app.db.get('SELECT * FROM brands WHERE id=?', info.lastInsertRowid), meta: { created: true } };
  });

  router.put('/api/admin/brands/:id', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const id = toNum(r.params.id);
    const existing = await app.db.get('SELECT * FROM brands WHERE id=?', id);
    if (!existing) throw new HttpError(404, 'Brand not found');
    const { name, description, image, featured, enabled } = r.body || {};
    const slug = await uniqueSlug(app.db, 'brands', slugify(name || existing.name), id);
    await app.db.run('UPDATE brands SET name=?, slug=?, description=?, image=?, featured=?, enabled=? WHERE id=?',
      String(name || existing.name).trim(), slug, String(description ?? existing.description), String(image ?? existing.image),
      featured !== undefined ? (featured ? 1 : 0) : existing.featured,
      enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
      id);
    return { success: true, data: await app.db.get('SELECT * FROM brands WHERE id=?', id), meta: { updated: true } };
  });

  router.delete('/api/admin/brands/:id', async (r, app) => {
    await requireRole(r, app, ['admin']);
    await app.db.run('DELETE FROM brands WHERE id=?', toNum(r.params.id));
    return { success: true, data: { deleted: true } };
  });
}