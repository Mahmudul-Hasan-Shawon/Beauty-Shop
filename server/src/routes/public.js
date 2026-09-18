const express = require('express');
const db = require('../db');
const { shapeProduct, parseJson } = require('../catalog');
const { ok, fail, asyncHandler } = require('../utils');

const router = express.Router();

const PRODUCT_FIELDS = `
  p.*, b.name AS brand_name, b.slug AS brand_slug, b.image AS brand_image,
  c.name AS category_name, c.slug AS category_slug
`;
const FROM = `FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN categories c ON c.id = p.category_id`;

function storeSettings() {
  const all = db.prepare('SELECT `key`, value FROM settings').all();
  const out = {};
  for (const row of all) out[row.key] = JSON.parse(row.value || '{}');
  return out;
}

function getProductsWithFilters(query = {}) {
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
    where.push(`(p.title LIKE @q OR p.sku LIKE @q OR p.tags_json LIKE @q OR p.ingredients_json LIKE @q OR p.short_description LIKE @q OR b.name LIKE @q)`);
    params.q = `%${q}%`;
  }
  if (category) {
    where.push(`(c.id = @category OR c.slug = @category)`);
    params.category = category;
  }
  if (brand) {
    where.push(`(b.id = @brand OR b.slug = @brand)`);
    params.brand = brand;
  }
  if (Number.isFinite(minPrice)) { where.push(`${priceBase} >= @minPrice`); params.minPrice = minPrice; }
  if (Number.isFinite(maxPrice)) { where.push(`${priceBase} <= @maxPrice`); params.maxPrice = maxPrice; }
  if (skinType) { where.push(`p.skin_types_json LIKE @skinType`); params.skinType = `%${skinType}%`; }
  if (concern) { where.push(`p.concerns_json LIKE @concern`); params.concern = `%${concern}%`; }
  if (productType) { where.push(`LOWER(p.product_type) = @pt`); params.pt = productType.toLowerCase(); }
  if (ingredient) { where.push(`p.ingredients_json LIKE @ing`); params.ing = `%${ingredient}%`; }
  if (Number.isFinite(minRating)) { where.push(`p.rating >= @minRating`); params.minRating = minRating; }
  if (availability === 'in') { where.push(`p.stock > 0`); }
  if (availability === 'out') { where.push(`p.stock <= 0`); }
  if (Number.isFinite(discountMin)) { where.push(`p.discount_pct >= @discountMin`); params.discountMin = discountMin; }
  if (featured) { where.push(`p.featured = 1`); }

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
  const countRow = db.prepare(`SELECT COUNT(*) AS c ${base.slice(base.indexOf(' FROM'))}`).get(params);
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = Math.min(48, Math.max(1, Number(query.perPage) || 12));
  const rows = db.prepare(`${base} ORDER BY ${sort} LIMIT @limit OFFSET @offset`).all({ ...params, limit: perPage, offset: (page - 1) * perPage });
  const products = rows.map((r) => {
    const variants = db.prepare('SELECT * FROM variants WHERE product_id=? ORDER BY id').all(r.id);
    return shapeProduct({ ...r, variants });
  });
  return {
    products,
    meta: { total: countRow.c, page, perPage, pages: Math.ceil(countRow.c / perPage) }
  };
}

router.get('/settings/public', (req, res) => {
  const s = storeSettings();
  const payment = s.payment ? s.payment.methods.filter((m) => m.enabled) : [];
  ok(res, {
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
  });
});

router.get('/products', (req, res) => {
  ok(res, getProductsWithFilters(req.query).products, getProductsWithFilters(req.query).meta);
});

router.get('/products/all-min', (req, res) => {
  const rows = db.prepare(`SELECT ${PRODUCT_FIELDS} ${FROM} WHERE p.status='published'`).all();
  ok(res, rows.map((r) => shapeProduct({ ...r, variants: [] })));
});

router.get('/products/suggest', (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (!q) return ok(res, []);
  const rows = db.prepare(`SELECT ${PRODUCT_FIELDS} ${FROM} WHERE p.status='published' AND (p.title LIKE @q OR p.tags_json LIKE @q OR b.name LIKE @q OR p.ingredients_json LIKE @q) ORDER BY p.views DESC LIMIT 8`)
    .all({ q: `%${q}%` });
  ok(res, rows.map((r) => ({
    id: r.id, name: r.title, slug: r.slug, thumbnail: r.thumbnail,
    salePrice: Number(r.sale_price || r.price || 0), price: Number(r.price || 0),
    discount: Number(r.discount_pct || 0), brand: r.brand_name, inStock: Number(r.stock) > 0
  })));
});

router.get('/products/popular', (req, res) => {
  const qs = String(req.query.q || '').trim().slice(0, 40);
  const items = db.prepare('SELECT value FROM settings WHERE `key`=?').get('popularSearches');
  const popular = parseJson(items?.value, ['vitamin c', 'snail mucin', 'sunscreen', 'rice', 'glutathione', 'toner']);
  const filtered = popular.filter((t) => !qs || t.toLowerCase().includes(qs.toLowerCase()));
  ok(res, filtered.slice(0, 10));
});

router.get('/products/:slug', (req, res) => {
  const row = db.prepare(`SELECT ${PRODUCT_FIELDS} ${FROM} WHERE p.slug=? AND p.status='published'`).get(req.params.slug);
  if (!row) return fail(res, 404, 'Product not found');
  const variants = db.prepare('SELECT * FROM variants WHERE product_id=? ORDER BY id').all(row.id);
  db.prepare('UPDATE products SET views = views + 1 WHERE id=?').run(row.id);
  const product = shapeProduct({ ...row, variants });
  const reviews = db.prepare("SELECT * FROM reviews WHERE product_id=? AND status='approved' ORDER BY featured DESC, created_at DESC LIMIT 20").all(row.id);
  ok(res, {
    ...product,
    faq: parseJson(db.prepare('SELECT value FROM settings WHERE `key`=?').get('product_faqs')?.value, [
      { q: `Is the ${row.title} authentic?`, a: 'Yes, we only source through authorized distributors and verify every batch.' },
      { q: 'What is the delivery time?', a: 'Inside Dhaka 1–2 working days, outside Dhaka 2–4 working days.' },
      { q: 'What if I have sensitive skin?', a: 'We recommend a patch test 24 hours before full use.' }
    ]),
    reviews,
    ratingDistribution: distribution(row.id),
    related: related(row)
  });
});

function distribution(productId) {
  const rows = db.prepare("SELECT rating, COUNT(*) c FROM reviews WHERE product_id=? AND status='approved' GROUP BY rating").all(productId);
  const total = rows.reduce((s, r) => s + r.c, 0) || 1;
  return [5, 4, 3, 2, 1].map((star) => {
    const c = rows.find((r) => Number(r.rating) === star)?.c || 0;
    return { star, count: c, percent: Math.round((c / total) * 100) };
  });
}

function related(row) {
  const rows = db.prepare(`SELECT ${PRODUCT_FIELDS} ${FROM}
    WHERE p.status='published' AND p.id<>? AND (p.brand_id=? OR p.category_id=? OR p.product_type=?)
    ORDER BY p.views DESC LIMIT 6`).all(row.id, row.brand_id, row.category_id, row.product_type);
  return rows.map((r) => {
    const variants = db.prepare('SELECT * FROM variants WHERE product_id=? ORDER BY id').all(r.id);
    return shapeProduct({ ...r, variants });
  });
}

router.get('/categories', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.status='published') AS productCount
    FROM categories c WHERE c.enabled=1 ORDER BY c.sort_order, c.id
  `).all();
  ok(res, rows.map((r) => ({ ...r, productCount: Number(r.productCount) })));
});

router.get('/brands', (req, res) => {
  const rows = db.prepare(`
    SELECT b.*, (SELECT COUNT(*) FROM products p WHERE p.brand_id=b.id AND p.status='published') AS productCount
    FROM brands b WHERE b.enabled=1 ORDER BY b.name
  `).all();
  ok(res, rows.map((r) => ({ ...r, productCount: Number(r.productCount) })));
});

router.get('/brands/:slug', (req, res) => {
  const brand = db.prepare('SELECT * FROM brands WHERE slug=? AND enabled=1').get(req.params.slug);
  if (!brand) return fail(res, 404, 'Brand not found');
  const { products, meta } = getProductsWithFilters({ brand: brand.slug, ...req.query });
  ok(res, { ...brand, products }, meta);
});

router.get('/banners', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.prepare("SELECT * FROM banners WHERE enabled=1 AND (start_date IS NULL OR start_date='' OR start_date<=?) AND (end_date IS NULL OR end_date='' OR end_date>=?) ORDER BY sort_order, id").all(today, today);
  ok(res, rows);
});

router.get('/journal', (req, res) => {
  const rows = db.prepare('SELECT id, title, slug, category, author, cover, excerpt, tags_json, created_at, updated_at FROM articles WHERE published=1 ORDER BY created_at DESC').all();
  ok(res, rows.map((r) => ({ ...r, tags: parseJson(r.tags_json), relatedProducts: parseJson(r.related_products_json) })));
});

router.get('/journal/:slug', (req, res) => {
  const row = db.prepare("SELECT * FROM articles WHERE slug=? AND published=1").get(req.params.slug);
  if (!row) return fail(res, 404, 'Article not found');
  const relatedP = relatedProductsByIds(parseJson(row.related_products_json));
  ok(res, { ...row, tags: parseJson(row.tags_json), relatedProducts: relatedP, recommended: defaultRecommendations(row) });
});

function relatedProductsByIds(ids) {
  if (!ids || !ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const list = db.prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...ids.map(Number));
  return list.map((r) => shapeProduct({ ...r, variants: [] }));
}

function defaultRecommendations(row) {
  const rows = db.prepare(`SELECT ${PRODUCT_FIELDS} ${FROM} WHERE p.status='published' ORDER BY p.featured DESC, p.views DESC LIMIT 4`).all();
  return rows.map((r) => shapeProduct({ ...r, variants: [] }));
}

router.get('/faqs', (req, res) => {
  const rows = db.prepare('SELECT * FROM faqs WHERE enabled=1 ORDER BY section, sort_order, id').all();
  ok(res, rows);
});

router.get('/page/:key', (req, res) => {
  const key = String(req.params.key).replace(/[^a-z]/g, '');
  const row = db.prepare('SELECT value FROM settings WHERE `key`=?').get(`page_${key}`);
  if (!row) return fail(res, 404, 'Page not found');
  ok(res, { content: row.value, key });
});

router.post('/contact', (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (!String(name || '').trim() || !String(email || '').includes('@') || !String(message || '').trim()) {
    return fail(res, 400, 'Please complete all required fields.');
  }
  db.prepare('INSERT INTO contact_messages (name, email, subject, message) VALUES (?,?,?,?)').run(
    String(name).trim().slice(0, 120), String(email).trim().slice(0, 160), String(subject || '').slice(0, 200), String(message).trim()
  );
  ok(res, { received: true });
});

router.post('/newsletter', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email.includes('@')) return fail(res, 400, 'Enter a valid email address.');
  db.prepare('INSERT OR IGNORE INTO newsletter (email) VALUES (?)').run(email);
  ok(res, { subscribed: true });
});

router.get('/routine.txt', (req, res) => {
  const questions = db.prepare('SELECT * FROM routine_questions ORDER BY sort_order, id').all();
  const data = questions.map((q) => {
    const options = db.prepare('SELECT * FROM routine_options WHERE question_id=? ORDER BY sort_order, id').all(q.id);
    return {
      id: q.id, question: q.question, subtitle: q.subtitle, multiple: !!q.multiple,
      options: options.map((o) => ({ id: o.id, label: o.label, value: o.value }))
    };
  });
  ok(res, data);
});

router.post('/routine/solve', (req, res) => {
  const answered = (req.body?.answers || []).map((a) => Number(a));
  if (!answered.length) return fail(res, 400, 'Please answer the questions.');
  const placeholders = answered.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM routine_results WHERE option_id IN (${placeholders})`).all(...answered);
  const ids = new Set();
  for (const r of rows) {
    for (const pid of parseJson(r.product_ids_json)) if (pid) ids.add(Number(pid));
  }
  const all = db.prepare(`SELECT ${PRODUCT_FIELDS} ${FROM} WHERE p.status='published' ORDER BY p.views DESC`).all();
  let scored = all.map((r) => {
    const id = r.id;
    let score = ids.has(id) ? 2 : 0;
    const concernTags = rows.map((rr) => rr.category).filter(Boolean);
    const tags = parseJson(r.tags_json);
    if (concernTags.some((ct) => tags.includes(ct))) score += 1;
    if (ids.has(id)) { ids.delete(id); score += 3; }
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const picks = scored.filter((s) => s.score > 0).map((s) => s.r).slice(0, 12);
  const results = (picks.length ? picks : all.slice(0, 8)).map((r) => shapeProduct({ ...r, variants: [] }));
  const productCount = results.length;
  const explanation = `We found ${productCount} products matched your skin profile`;
  ok(res, { products: results, explanation });
});

module.exports = router;