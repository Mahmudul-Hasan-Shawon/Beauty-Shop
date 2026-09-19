import { shapeProduct, parseJson } from '../catalog.js';
import { HttpError } from '../router.js';

const PRODUCT_FIELDS = `
  p.*, b.name AS brand_name, b.slug AS brand_slug, b.image AS brand_image,
  c.name AS category_name, c.slug AS category_slug
`;
const FROM = `FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN categories c ON c.id = p.category_id`;

async function storeSettings(db) {
  const all = await db.all('SELECT `key`, value FROM settings');
  const out = {};
  for (const row of all) {
    try { out[row.key] = JSON.parse(row.value || '{}'); } catch { out[row.key] = {}; }
  }
  return out;
}

async function getProductsWithFilters(db, query = {}) {
  const where = [];
  const params = {};
  const q = String(query.q || '').trim();
  const category = String(query.category || '').trim();
  const brand = String(query.brand || '').trim();
  const minPrice = Number(query.minPrice);
  const maxPrice = Number(query.maxPrice);
  const skinType = String(query.skinType || '').trim();
  const concern = String(query.concern || '').trim();
  const productType = String(query.productType || '').trim();
  const ingredient = String(query.ingredient || '').trim();
  const minRating = Number(query.minRating);
  const availability = String(query.availability || '').trim();
  const discountMin = Number(query.discountMin);
  const featured = String(query.featured || '').trim();

  const priceBase = 'COALESCE(NULLIF(p.sale_price, 0), p.price)';

  where.push("p.status = 'published'");
  if (q) {
    where.push('(p.title LIKE @q OR p.sku LIKE @q OR p.tags_json LIKE @q OR p.ingredients_json LIKE @q OR p.short_description LIKE @q OR b.name LIKE @q)');
    params.q = `%${q}%`;
  }
  if (category) {
    where.push('(c.id = @category OR c.slug = @category)');
    params.category = category;
  }
  if (brand) {
    where.push('(b.id = @brand OR b.slug = @brand)');
    params.brand = brand;
  }
  if (Number.isFinite(minPrice)) { where.push(`${priceBase} >= @minPrice`); params.minPrice = minPrice; }
  if (Number.isFinite(maxPrice)) { where.push(`${priceBase} <= @maxPrice`); params.maxPrice = maxPrice; }
  if (skinType) { where.push('p.skin_types_json LIKE @skinType'); params.skinType = `%${skinType}%`; }
  if (concern) { where.push('p.concerns_json LIKE @concern'); params.concern = `%${concern}%`; }
  if (productType) { where.push('LOWER(p.product_type) = @pt'); params.pt = productType.toLowerCase(); }
  if (ingredient) { where.push('p.ingredients_json LIKE @ing'); params.ing = `%${ingredient}%`; }
  if (Number.isFinite(minRating)) { where.push('p.rating >= @minRating'); params.minRating = minRating; }
  if (availability === 'in') { where.push('p.stock > 0'); }
  if (availability === 'out') { where.push('p.stock <= 0'); }
  if (Number.isFinite(discountMin)) { where.push('p.discount_pct >= @discountMin'); params.discountMin = discountMin; }
  if (featured) { where.push('p.featured = 1'); }

  const sortMap = {
    featured: 'p.featured DESC, p.views DESC, p.id ASC',
    newest: 'p.created_at DESC',
    'price-asc': `(${priceBase}) ASC`,
    'price-desc': `(${priceBase}) DESC`,
    'rating-desc': 'p.rating DESC, p.review_count DESC',
    popular: 'p.views DESC',
    discount: 'p.discount_pct DESC',
    'best-seller': 'p.best_seller DESC, p.views DESC'
  };
  const sort = sortMap[String(query.sort || 'featured')] || sortMap.featured;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const base = `SELECT ${PRODUCT_FIELDS} ${FROM} ${whereSql}`;
  const countRow = await db.get(`SELECT COUNT(*) AS c ${base.slice(base.indexOf(' FROM'))}`, params);
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = Math.min(48, Math.max(1, Number(query.perPage) || 12));
  const rows = await db.all(`${base} ORDER BY ${sort} LIMIT @limit OFFSET @offset`, { ...params, limit: perPage, offset: (page - 1) * perPage });
  const products = [];
  for (const r of rows) {
    const variants = await db.all('SELECT * FROM variants WHERE product_id=? ORDER BY id', r.id);
    products.push(shapeProduct({ ...r, variants }));
  }
  return {
    products,
    meta: { total: countRow.c, page, perPage, pages: Math.ceil(countRow.c / perPage) }
  };
}

async function distribution(db, productId) {
  const rows = await db.all("SELECT rating, COUNT(*) c FROM reviews WHERE product_id=? AND status='approved' GROUP BY rating", productId);
  const total = rows.reduce((s, r) => s + r.c, 0) || 1;
  return [5, 4, 3, 2, 1].map((star) => {
    const c = rows.find((r) => Number(r.rating) === star)?.c || 0;
    return { star, count: c, percent: Math.round((c / total) * 100) };
  });
}

async function related(db, row) {
  const rows = await db.all(`SELECT ${PRODUCT_FIELDS} ${FROM}
    WHERE p.status='published' AND p.id<>? AND (p.brand_id=? OR p.category_id=? OR p.product_type=?)
    ORDER BY p.views DESC LIMIT 6`, row.id, row.brand_id, row.category_id, row.product_type);
  const out = [];
  for (const r of rows) {
    const variants = await db.all('SELECT * FROM variants WHERE product_id=? ORDER BY id', r.id);
    out.push(shapeProduct({ ...r, variants }));
  }
  return out;
}

async function relatedProductsByIds(db, ids) {
  if (!ids || !ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const list = await db.all(`SELECT * FROM products WHERE id IN (${placeholders})`, ...ids.map(Number));
  return list.map((r) => shapeProduct({ ...r, variants: [] }));
}

async function defaultRecommendations(db, source = {}) {
  const rows = await db.all(`SELECT ${PRODUCT_FIELDS} ${FROM} WHERE p.status='published' ORDER BY p.featured DESC, p.views DESC LIMIT 4`);
  return rows.map((r) => shapeProduct({ ...r, variants: [] }));
}

export function mount(router) {

  router.get('/api/settings/public', async (r, app) => {
    const s = await storeSettings(app.db);
    const payment = s.payment ? s.payment.methods.filter((m) => m.enabled) : [];
    return {
      success: true,
      data: {
        store: {
          name: s.store?.name || 'Petal & Rose',
          tagline: s.store?.tagline || '',
          logo: s.store?.logo || '',
          phone: s.store?.phone || '',
          email: s.store?.email || '',
          address: s.store?.address || '',
          socials: s.store?.socials || {},
          currency: s.store?.currency || 'BDT'
        },
        shipping: s.shipping || null,
        paymentMethods: payment,
        seo: s.seo || null,
        hero: s.hero || null,
        routineIntro: s.routineIntro || null
      }
    };
  });

  router.get('/api/products', async (r, app) => {
    const res = await getProductsWithFilters(app.db, r.query);
    return { success: true, data: res.products, meta: res.meta };
  });

  router.get('/api/products/all-min', async (r, app) => {
    const rows = await app.db.all(`SELECT ${PRODUCT_FIELDS} ${FROM} WHERE p.status='published'`);
    return { success: true, data: rows.map((row) => shapeProduct({ ...row, variants: [] })) };
  });

  router.get('/api/products/suggest', async (r, app) => {
    const q = String(r.query.q || '').trim().slice(0, 60);
    if (!q) return { success: true, data: [] };
    const rows = await app.db.all(`SELECT ${PRODUCT_FIELDS} ${FROM} WHERE p.status='published' AND (p.title LIKE @q OR p.tags_json LIKE @q OR b.name LIKE @q OR p.ingredients_json LIKE @q) ORDER BY p.views DESC LIMIT 8`, { q: `%${q}%` });
    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id, name: row.title, slug: row.slug, thumbnail: row.thumbnail,
        salePrice: Number(row.sale_price || row.price || 0), price: Number(row.price || 0),
        discount: Number(row.discount_pct || 0), brand: row.brand_name, inStock: Number(row.stock) > 0
      }))
    };
  });

  router.get('/api/products/popular', async (r, app) => {
    const qs = String(r.query.q || '').trim().slice(0, 40);
    const items = await app.db.get('SELECT value FROM settings WHERE `key`=?', 'popularSearches');
    const popular = parseJson(items?.value, ['vitamin c', 'snail mucin', 'sunscreen', 'rice', 'glutathione', 'toner']);
    const filtered = popular.filter((t) => !qs || t.toLowerCase().includes(qs.toLowerCase()));
    return { success: true, data: filtered.slice(0, 10) };
  });

  router.get('/api/products/:slug', async (r, app) => {
    const row = await app.db.get(`SELECT ${PRODUCT_FIELDS} ${FROM} WHERE p.slug=? AND p.status='published'`, r.params.slug);
    if (!row) throw new HttpError(404, 'Product not found');
    const variants = await app.db.all('SELECT * FROM variants WHERE product_id=? ORDER BY id', row.id);
    await app.db.run('UPDATE products SET views = views + 1 WHERE id=?', row.id);
    const product = shapeProduct({ ...row, variants });
    const reviews = await app.db.all("SELECT * FROM reviews WHERE product_id=? AND status='approved' ORDER BY featured DESC, created_at DESC LIMIT 20", row.id);
    return {
      success: true,
      data: {
        ...product,
        faq: parseJson((await app.db.get('SELECT value FROM settings WHERE `key`=?', 'product_faqs'))?.value, [
          { q: `Is the ${row.title} authentic?`, a: 'Yes, we only source through authorized distributors and verify every batch.' },
          { q: 'What is the delivery time?', a: 'Inside Dhaka 1-2 working days, outside Dhaka 2-4 working days.' },
          { q: 'What if I have sensitive skin?', a: 'We recommend a patch test 24 hours before full use.' }
        ]),
        reviews,
        ratingDistribution: await distribution(app.db, row.id),
        related: await related(app.db, row)
      }
    };
  });

  router.get('/api/categories', async (r, app) => {
    const rows = await app.db.all(`
      SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.status='published') AS productCount
      FROM categories c WHERE c.enabled=1 ORDER BY c.sort_order, c.id
    `);
    return { success: true, data: rows.map((row) => ({ ...row, productCount: Number(row.productCount) })) };
  });

  router.get('/api/brands', async (r, app) => {
    const rows = await app.db.all(`
      SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id=b.id AND p.status='published') AS productCount
      FROM brands b WHERE b.enabled=1 ORDER BY b.name
    `);
    return { success: true, data: rows.map((row) => ({ ...row, productCount: Number(row.productCount) })) };
  });

  router.get('/api/brands/:slug', async (r, app) => {
    const brand = await app.db.get('SELECT * FROM brands WHERE slug=? AND enabled=1', r.params.slug);
    if (!brand) throw new HttpError(404, 'Brand not found');
    const res = await getProductsWithFilters(app.db, { brand: brand.slug, ...r.query });
    return { success: true, data: { ...brand, products: res.products }, meta: res.meta };
  });

  router.get('/api/banners', async (r, app) => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await app.db.all("SELECT * FROM banners WHERE enabled=1 AND (start_date IS NULL OR start_date='' OR start_date<=?) AND (end_date IS NULL OR end_date='' OR end_date>=?) ORDER BY sort_order, id", today, today);
    return { success: true, data: rows };
  });

  router.get('/api/journal', async (r, app) => {
    const rows = await app.db.all('SELECT id, title, slug, category, author, cover, excerpt, tags_json, created_at, updated_at FROM articles WHERE published=1 ORDER BY created_at DESC');
    return { success: true, data: rows.map((row) => ({ ...row, tags: parseJson(row.tags_json), relatedProducts: parseJson(row.related_products_json) })) };
  });

  router.get('/api/journal/:slug', async (r, app) => {
    const row = await app.db.get("SELECT * FROM articles WHERE slug=? AND published=1", r.params.slug);
    if (!row) throw new HttpError(404, 'Article not found');
    return {
      success: true,
      data: { ...row, tags: parseJson(row.tags_json), relatedProducts: await relatedProductsByIds(app.db, parseJson(row.related_products_json)), recommended: await defaultRecommendations(app.db, row) }
    };
  });

  router.get('/api/faqs', async (r, app) => {
    const rows = await app.db.all('SELECT * FROM faqs WHERE enabled=1 ORDER BY section, sort_order, id');
    return { success: true, data: rows };
  });

  router.get('/api/page/:key', async (r, app) => {
    const key = String(r.params.key).replace(/[^a-z]/g, '');
    const row = await app.db.get('SELECT value FROM settings WHERE `key`=?', `page_${key}`);
    if (!row) throw new HttpError(404, 'Page not found');
    return { success: true, data: { content: row.value, key } };
  });

  router.post('/api/contact', async (r, app) => {
    const { name, email, subject, message } = r.body || {};
    if (!String(name || '').trim() || !String(email || '').includes('@') || !String(message || '').trim()) {
      throw new HttpError(400, 'Please complete all required fields.');
    }
    await app.db.run('INSERT INTO contact_messages (name, email, subject, message) VALUES (?,?,?,?)',
      String(name).trim().slice(0, 120), String(email).trim().slice(0, 160), String(subject || '').slice(0, 200), String(message).trim());
    return { success: true, data: { received: true } };
  });

  router.post('/api/newsletter', async (r, app) => {
    const email = String(r.body?.email || '').trim().toLowerCase();
    if (!email.includes('@')) throw new HttpError(400, 'Enter a valid email address.');
    await app.db.run('INSERT OR IGNORE INTO newsletter (email) VALUES (?)', email);
    return { success: true, data: { subscribed: true } };
  });

  router.get('/api/routine.txt', async (r, app) => {
    const questions = await app.db.all('SELECT * FROM routine_questions ORDER BY sort_order, id');
    const data = [];
    for (const qRow of questions) {
      const options = await app.db.all('SELECT * FROM routine_options WHERE question_id=? ORDER BY sort_order, id', qRow.id);
      data.push({
        id: qRow.id, question: qRow.question, subtitle: qRow.subtitle, multiple: !!qRow.multiple,
        options: options.map((o) => ({ id: o.id, label: o.label, value: o.value }))
      });
    }
    return { success: true, data };
  });

  router.post('/api/routine/solve', async (r, app) => {
    const answered = (r.body?.answers || []).map((a) => Number(a));
    if (!answered.length) throw new HttpError(400, 'Please answer the questions.');
    const placeholders = answered.map(() => '?').join(',');
    const rows = await app.db.all(`SELECT * FROM routine_results WHERE option_id IN (${placeholders})`, ...answered);
    const ids = new Set();
    for (const rr of rows) {
      for (const pid of parseJson(rr.product_ids_json)) if (pid) ids.add(Number(pid));
    }
    const all = await app.db.all(`SELECT ${PRODUCT_FIELDS} ${FROM} WHERE p.status='published' ORDER BY p.views DESC`);
    const scored = all.map((rr) => {
      const id = rr.id;
      let score = Number(ids.has(id)) * 2;
      const concernTags = rows.map((x) => x.category).filter(Boolean);
      const tags = parseJson(rr.tags_json);
      if (concernTags.some((ct) => tags.includes(ct))) score += 1;
      if (ids.has(id)) { ids.delete(id); score += 3; }
      return { rr, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const picks = scored.filter((s) => s.score > 0).map((s) => s.rr).slice(0, 12);
    const results = (picks.length ? picks : all.slice(0, 8)).map((row) => shapeProduct({ ...row, variants: [] }));
    return { success: true, data: { products: results, explanation: `We found ${results.length} products matched your skin profile` } };
  });

  router.get('/api/health', async () => ({ success: true, data: { ok: true, time: new Date().toISOString() } }));
}