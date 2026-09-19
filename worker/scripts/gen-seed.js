const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SEED_JSON = path.join(__dirname, '..', '..', 'server', 'data', 'seed-data.json');
const OUT = path.join(__dirname, '..', 'seed.sql');
const STORE_NAME = 'Petal & Rose';
const ADMIN_EMAIL = 'admin@petalrose.com';
const ADMIN_PASSWORD = 'Admin@12345';

const lines = [];
function q(v) {
  return "'" + String(v ?? '').replace(/'/g, "''") + "'";
}
function nu(v) {
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '0';
}
function add(sql) { lines.push(sql + ';'); }

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

function clampRating(r) {
  const n = toNum(r, 4.5);
  return Math.min(5, Math.max(1, Math.round(n * 10) / 10));
}

let seedRandomState = 42;
function rand() {
  seedRandomState = (seedRandomState * 1103515245 + 12345) % 2147483648;
  return seedRandomState / 2147483648;
}

function pbkdf2Hash(password) {
  const iter = 100000;
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, iter, 32, 'sha256');
  return `pbkdf2_sha256$${iter}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

// --- load seed ---
const seed = JSON.parse(fs.readFileSync(SEED_JSON, 'utf8'));
const seedLines = lines;

// reset (only relevant on re-run)
add('DELETE FROM products');
add('DELETE FROM variants');
add('DELETE FROM reviews');
add('DELETE FROM brands');
add('DELETE FROM categories');
add('DELETE FROM banners');
add('DELETE FROM articles');
add('DELETE FROM faqs');
add('DELETE FROM routine_results');
add('DELETE FROM routine_options');
add('DELETE FROM routine_questions');
add('DELETE FROM admins');
add('DELETE FROM settings');

// categories
const catSlugs = new Set();
const catIdBySlug = {};
let catOrder = 0;
for (const c of seed.categories) {
  let slug = slugify(c.slug || c.name);
  if (catSlugs.has(slug)) slug = `${slug}-${++catOrder}`;
  catSlugs.add(slug);
  add(`INSERT INTO categories (name, slug, description, image, sort_order, featured) VALUES (${q(c.name)}, ${q(slug)}, ${q(c.description)}, ${q(c.image)}, ${catOrder++}, 1)`);
  catIdBySlug[slug] = catOrder;
}

// brands
const brandIds = {};
{
  const used = new Set();
  let i = 1;
  for (const b of seed.brands) {
    let slug = slugify(b.slug || b.name);
    let k = 0;
    while (used.has(slug)) slug = `${slugify(b.slug || b.name)}-${++k}`;
    used.add(slug);
    add(`INSERT INTO brands (name, slug, description, image, featured) VALUES (${q(b.name)}, ${q(slug)}, ${q(b.description)}, ${q(b.image)}, ${b.featured ? 1 : 0})`);
    brandIds[b.name.toLowerCase()] = i;
    i++;
  }
}

// products
const productIds = []; // ordered inserted ids, 1-based
const usedSlugs = new Set();
const usedSkus = new Set();
let seen = new Set();
let pIdx = 0;
for (const p of seed.products) {
  const brandId = brandIds[p.brand.toLowerCase()] || null;
  const cat = seed.categories.find(
    (c) => c.name.toLowerCase() === String(p.mainCategory || 'Skincare').toLowerCase().replace('and', '&')
  ) || seed.categories[0];
  const catSlug = slugify(cat.slug || cat.name);
  const categoryId = catIdBySlug[catSlug] || null;

  const images = [p.imageUrl, ...(p.gallery || [])].filter(Boolean);
  const uniqueImages = [...new Set(images)].slice(0, 6);
  const gallery = uniqueImages.length > 1 ? uniqueImages : [uniqueImages[0] || '', p.imageUrl || ''].filter(Boolean);

  const title = p.title;
  let slug = slugify(`${p.brand}-${title}`);
  let k = 1;
  while (usedSlugs.has(slug)) slug = `${slugify(`${p.brand}-${title}`)}-${k++}`;
  usedSlugs.add(slug);

  let sku = String(p.sku || '');
  let si = 1;
  while (usedSkus.has(sku)) sku = `${String(p.sku || '')}-${si++}`;
  usedSkus.add(sku);

  const price = toNum(p.offerPrice);
  const rating = clampRating(4.2 + rand() * 0.7);
  const reviewCount = Math.floor(rand() * 90) + 4;
  const featured = pIdx < 8 && !/cleanser/i.test(title) && !/mask/i.test(title) ? 1 : 0;
  const bestSeller = /glow|essence|serum|relief sun|sun/i.test(title) && toNum(p.stock) > 80 ? 1 : 0;
  const newArrival = pIdx % 3 === 0 ? 1 : 0;
  const trending = /snail|glutathione|vitamin|toner/i.test(title) ? 1 : 0;
  const tags = ['skincare', ...String(p.tags || '').split(',').filter(Boolean).map((s) => s.trim()).slice(0, 8)];

  add(`INSERT INTO products (sku, title, slug, brand_id, category_id, main_category, product_type, size,
    description, short_description, price, sale_price, discount_pct, stock, status, featured, best_seller,
    new_arrival, trending, rating, review_count, tags_json, ingredients_json, benefits_json, how_to_use,
    skin_types_json, concerns_json, images_json, thumbnail, seo_title, seo_description)
    VALUES (${q(sku)}, ${q(title)}, ${q(slug)}, ${brandId == null ? 'NULL' : brandId}, ${categoryId == null ? 'NULL' : categoryId},
    ${q(p.mainCategory || 'Skincare')}, ${q(p.productType || p.category || '')}, ${q(p.size || '')},
    ${q(p.description || '')}, ${q(p.shortDescription || '')}, ${nu(price)}, ${nu(price)}, ${nu(toNum(p.discountPct))},
    ${nu(toNum(p.stock))}, 'published', ${featured}, ${bestSeller}, ${newArrival}, ${trending},
    ${nu(rating)}, ${reviewCount}, ${q(JSON.stringify(tags))}, ${q(JSON.stringify(p.ingredients || []))},
    ${q(JSON.stringify(p.benefits || []))}, ${q(p.howToUse || '')}, ${q(JSON.stringify(p.skinTypes || []))},
    ${q(JSON.stringify(p.concerns || []))}, ${q(JSON.stringify(gallery))}, ${q(gallery[0] || '')},
    ${q(`${title} — ${p.brand} | ${STORE_NAME}`)}, ${q(p.shortDescription || '')})`);

  const pid = pIdx + 1;
  productIds.push(pid);

  const variants = (p.variants && p.variants.length) ? p.variants : [{ size: p.size, sku, stock: p.stock, price: toNum(p.offerPrice), old_price: toNum(p.oldPrice), image: p.imageUrl }];
  for (const v of variants) {
    add(`INSERT INTO variants (product_id, sku, size, price, old_price, stock, image) VALUES (${pid}, ${q(v.sku || sku)}, ${q(v.size)}, ${nu(toNum(v.price))}, ${nu(toNum(v.oldPrice || p.oldPrice))}, ${nu(toNum(v.stock))}, ${q(v.image || '')})`);
  }

  if (pIdx < 6) {
    const names = ['Ayesha Rahman', 'Sadia Khan', 'Nusrat Jahan', 'Tanvir Ahmed', 'Mithila Chowdhury', 'Farhana Islam'];
    for (let r = 0; r < 3; r++) {
      const revRating = clampRating(4 + rand() * 1);
      add(`INSERT INTO reviews (product_id, customer_name, rating, title, text, verified, status, featured) VALUES (${pid}, ${q(names[(pIdx + r) % names.length])}, ${nu(revRating)}, ${q(r % 2 ? 'Lovely texture' : 'Worth every taka')}, ${q('Absolutely love how my skin feels after using this. Fast delivery, genuine product and beautiful packaging. Highly recommended!')}, ${r > 0 ? 1 : 0}, 'approved', ${r === 0 ? 1 : 0})`);
    }
  }
  pIdx++;
}

// banners
(seed.banners || []).slice(0, 6).forEach((b, i) => {
  add(`INSERT INTO banners (eyebrow, title, description, button_text, link, image, sort_order, enabled, start_date, end_date) VALUES (${q(b.eyebrow)}, ${q(b.title)}, ${q(b.description)}, ${q(b.buttonText || 'Shop Now')}, ${q(b.link || '/shop')}, ${q(b.image)}, ${i + 1}, 1, ${q(b.startDate || '')}, ${q(b.endDate || '')})`);
});

// journal articles
const articles = [
  { title: 'The Rice Water Ritual: Brightening from the First Wash', category: 'Routine', author: 'Editorial Team', cover: 'https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?w=1200&auto=format', excerpt: 'Rice water has been a Korean beauty staple for generations. Here is how to layer rice-powered skincare into your everyday ritual.', content: 'Rice water is rich in vitamins, minerals and amino acids that help skin feel softer and look brighter. Start with a rice-based foaming cleanser, follow with a rice toner, and seal everything in with a rice ceramide cream for a dewy, glass-skin finish. Patience is the key — visible change comes from consistency.', tags: ['rice', 'brightening', 'korean'] },
  { title: 'SPF Decoded: Choosing the Right Sunscreen for Bondhan Season', category: 'Ingredient Guide', author: 'Editorial Team', cover: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=1200&auto=format', excerpt: 'SPF 30 or 50? Chemical or mineral? We break down everything you need to know to pick your perfect daily sunscreen.', content: 'Look for a broad-spectrum SPF 50 PA++++ for daily wear in humid climates. Gel or watery textures layer beautifully under makeup without heaviness, while rice- and panthenol-infused formulas soothe as they protect. Apply two finger lengths across the face and neck every morning — rain or shine.', tags: ['sunscreen', 'spf', 'sun care'] },
  { title: 'Snail Mucin, Explained: The 96% Essence Cult Classic', category: 'Ingredient Guide', author: 'Editorial Team', cover: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=1200&auto=format', excerpt: 'The internet is obsessed. We explain why snail mucin has earned its place in routines from Seoul to Dhaka.', content: 'Snail secretion filtrate is prized for delivering a rich dose of hydrating glycoproteins, hyaluronic acid and glycolic acid. The 96% mucin essence has a light, stringy texture that layers beautifully. It suits most skin types and pairs well after the toner step, before heavier creams.', tags: ['snail mucin', 'hydration', 'essence'] },
  { title: '7-Step Glass Skin Routine for Humid Weather', category: 'Routine', author: 'Editorial Team', cover: 'https://images.unsplash.com/photo-1556228852-6d35a585d566?w=1200&auto=format', excerpt: 'A realistic, seven-step evening routine built for Bangladeshi humidity — without the heavy finish.', content: 'Double cleanse to melt sunscreen, tone with a clarifying formula, pat in an essence, layer a brightening serum like niacinamide, apply a light ampoule, then finish with a gel cream or milk moisturizer. Adjust textures by season and keep SPF on during the day.', tags: ['routine', 'glass skin', 'skincare'] }
];
{
  const used = new Set();
  articles.forEach((a) => {
    let slug = slugify(a.title);
    let i = 1;
    while (used.has(slug)) slug = `${slugify(a.title)}-${i++}`;
    used.add(slug);
    add(`INSERT INTO articles (title, slug, category, author, cover, excerpt, content, tags_json, published) VALUES (${q(a.title)}, ${q(slug)}, ${q(a.category)}, ${q(a.author)}, ${q(a.cover)}, ${q(a.excerpt)}, ${q(a.content)}, ${q(JSON.stringify(a.tags))}, 1)`);
  });
}

// faqs
const faqs = [
  ['Are your products 100% authentic?', 'Yes. Every product is sourced through authorized distributors and verified before being listed. Authenticity is the foundation of what we do.', 'general', 1],
  ['How long does delivery take?', 'Inside Dhaka: 1–2 working days. Outside Dhaka: 2–4 working days. Orders placed before 3 PM usually ship the same day.', 'shipping', 2],
  ['What is the delivery charge?', 'Delivery inside Dhaka is ৳60 and outside Dhaka is ৳120.', 'shipping', 3],
  ['Which payment methods do you accept?', 'We accept Cash on Delivery, bKash and Nagad. Our payment team will confirm your order over the phone after you place it.', 'payment', 4],
  ['How do I track my order?', 'Use the Order Tracking page and enter your Order ID or your phone number to see the live status of your order.', 'orders', 5],
  ['Can I return or exchange a product?', 'Unopened, unused products can be returned within 7 days of delivery. Please reach out to our support team to arrange a return.', 'returns', 6],
  ['How do I find the right products for my skin?', 'Try our "Find Your Routine" quiz — answer a few questions and we will recommend a personalized routine built around your skin type and concerns.', 'general', 7]
];
faqs.forEach(([a, b, c, d]) => {
  add(`INSERT INTO faqs (question, answer, section, sort_order) VALUES (${q(a)}, ${q(b)}, ${q(c)}, ${d})`);
});

// routine questions / options / results
{
  const productTags = [];
  let pi = 1;
  for (const p of seed.products) {
    const tags = ['skincare', ...String(p.tags || '').split(',').filter(Boolean).map((s) => s.trim()).slice(0, 8)];
    productTags.push({ id: pi, title: p.title, tags });
    pi++;
  }
  const productIdsMap = { brightening: [], hydration: [], glow: [], sun: [], calming: [] };
  for (const p of productTags) {
    const t = `${p.title} ${p.tags.join(' ')}`.toLowerCase();
    if (/(bright|glow|whiten|tone|vitamin|niacinamide|glutathione|dark spot)/.test(t)) productIdsMap.brightening.push(p.id);
    if (/(hydrat|hyaluron|moistur|ceramide|essence|snail)/.test(t)) productIdsMap.hydration.push(p.id);
    if (/(sun|uv|spf)/.test(t)) productIdsMap.sun.push(p.id);
    if (/(calm|relief|sooth|green tea|centella)/.test(t)) productIdsMap.calming.push(p.id);
  }
  const tagMap = { brightening: ['brightening'], acne: ['acne'], glow: ['glow'], hydration: ['hydration'], aging: ['aging'], pores: ['pores'], minimal: ['cleanser'], full: ['serum'], pampering: ['mask'], budget: [], mid: [], premium: [] };
  const allIds = productTags.map((p) => p.id);
  const questions = [
    { q: 'What is your skin type?', sub: 'Choose the one that describes your skin most days.', multiple: 0, opts: [['Dry', 'dry'], ['Oily', 'oily'], ['Combination', 'combination'], ['Normal', 'normal'], ['Sensitive', 'sensitive']] },
    { q: 'What is your main skin concern?', sub: 'Pick what you want to improve the most.', multiple: 1, opts: [['Dark spots & uneven tone', 'brightening'], ['Acne & breakouts', 'acne'], ['Dullness & low glow', 'glow'], ['Dryness & dehydration', 'hydration'], ['Lines & elasticity', 'aging'], ['Oil & big pores', 'pores']] },
    { q: 'How would you describe your daily routine?', sub: 'How much time can you spend on your skin?', multiple: 0, opts: [['Just the basics (3 steps)', 'minimal'], ['A complete routine (5–7 steps)', 'full'], ['I love sheet masks & extras', 'pampering']] },
    { q: 'What is your preferred budget?', sub: 'Price is only one factor — quality stays high.', multiple: 0, opts: [['Value focused', 'budget'], ['Mid-range', 'mid'], ['Premium / luxury', 'premium']] }
  ];
  questions.forEach((qq, qi) => {
    add(`INSERT INTO routine_questions (question, subtitle, multiple, sort_order) VALUES (${q(qq.q)}, ${q(qq.sub)}, ${qq.multiple}, ${qi + 1})`);
    const qid = qi + 1;
    qq.opts.forEach(([label, value], oi) => {
      const oid = oi + 1;
      let ids = productIdsMap[value] || allIds;
      if (tagMap[value] && tagMap[value].length) {
        const matched = productTags.filter((p) => p.tags.join(' ').toLowerCase().includes(tagMap[value][0]));
        if (matched.length) ids = matched.map((p) => p.id);
      }
      add(`INSERT INTO routine_options (question_id, label, value, sort_order) VALUES (${qid}, ${q(label)}, ${q(value)}, ${oid})`);
      add(`INSERT INTO routine_results (option_id, category, tags_json, product_ids_json) VALUES (${oid}, ${q(value)}, ${q(JSON.stringify(tagMap[value] || []))}, ${q(JSON.stringify([...ids].slice(0, 12)))})`);
    });
  });
}

// admins
add(`INSERT INTO admins (name, email, password_hash, role) VALUES ('Store Owner', ${q(ADMIN_EMAIL)}, ${q(pbkdf2Hash(ADMIN_PASSWORD))}, 'admin')`);
add(`INSERT INTO admins (name, email, password_hash, role) VALUES ('Content Editor', 'editor@petalrose.com', ${q(pbkdf2Hash('Editor@123'))}, 'editor')`);
add(`INSERT INTO admins (name, email, password_hash, role) VALUES ('Order Manager', 'orders@petalrose.com', ${q(pbkdf2Hash('Orders@123'))}, 'order_manager')`);

// settings
const settings = {
  store: JSON.stringify({ name: STORE_NAME, tagline: 'Beauty, curated for you.', logo: '', favicon: '', phone: '+880 1874 460244', email: 'hello@petalrose.com', address: 'Level 3, House 12, Road 5, Gulshan 1, Dhaka 1212', currency: 'BDT', socials: { facebook: '', instagram: '', tiktok: '', whatsapp: '8801874460244', x: '' } }),
  shipping: JSON.stringify({ insideFee: 60, outsideFee: 120, freeThreshold: 2500, methods: ['inside', 'outside'] }),
  payment: JSON.stringify({ methods: [
    { id: 'cod', label: 'Cash on Delivery', enabled: true, instruction: 'Pay in cash when your order arrives.' },
    { id: 'bkash', label: 'bKash', enabled: true, number: '', instruction: 'Send payment to the bKash number shown during checkout and share the TrxID in the notes.' },
    { id: 'nagad', label: 'Nagad', enabled: true, number: '', instruction: 'Send payment to the Nagad number shown during checkout and share the TrxID in the notes.' },
    { id: 'card', label: 'Online Payment', enabled: false, instruction: 'Pay securely using your card through our gateway.' }
  ] }),
  tax: JSON.stringify({ enabled: false, rate: 0, label: 'VAT' }),
  notifications: JSON.stringify({ newOrder: true, lowStock: true, newReview: true, orderShipped: true, orderDelivered: true, orderCancelled: true, lowStockThreshold: 10 }),
  seo: JSON.stringify({ siteTitle: `${STORE_NAME} — Luxury Skincare & Beauty`, metaDescription: `${STORE_NAME} — authentic Korean skincare and beauty essentials, curated for glowing, healthy skin.`, ogImage: '', googleVerification: '', sitemap: true }),
  hero: JSON.stringify({ enabled: true, eyebrow: 'Authentic Beauty · Carefully Curated', heading: 'Beauty, Curated For You', description: 'Discover skincare and beauty essentials selected to elevate your everyday routine.', primaryCta: 'Shop Collection', primaryLink: '/shop', secondaryCta: 'Explore Best Sellers', secondaryLink: '/shop?sort=best', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1400&auto=format' }),
  routineIntro: JSON.stringify({ eyebrow: 'Find Your Routine', heading: 'A routine built around you', description: 'Answer a few questions and we will curate the perfect beauty shelf for your skin.' })
};
for (const [k, v] of Object.entries(settings)) {
  add(`INSERT INTO settings (key, value) VALUES (${q(k)}, ${q(v)})`);
}

fs.writeFileSync(OUT, '-- Petal & Rose seed\n' + lines.join('\n') + '\n');
console.log('Wrote', OUT, '-', lines.length, 'statements');