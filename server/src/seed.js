const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { slugify, toNum, toBool, clampRating } = require('./utils');

const SEED_JSON = path.join(__dirname, '..', 'data', 'seed-data.json');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@petalrose.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@12345';
const STORE_NAME = process.env.STORE_NAME || 'Petal & Rose';

function ensureUniqueSlug(table, slug, id) {
  let s = slug;
  let i = 1;
  while (db.prepare(`SELECT id FROM ${table} WHERE slug=? AND id<>?`).get(s, id || 0)) {
    s = `${slug}-${i++}`;
  }
  return s;
}

function ensureUniqueSku(sku) {
  let s = sku;
  let i = 1;
  while (db.prepare('SELECT id FROM products WHERE sku=?').get(s)) {
    s = `${sku}-${i++}`;
  }
  return s;
}

function seedIfEmpty() {
  const productCount = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  if (productCount > 0) {
    console.log(`[seed] Database already has ${productCount} products. Skipping.`);
    return;
  }

  const seed = JSON.parse(fs.readFileSync(SEED_JSON, 'utf8'));

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM products').run();

    // categories
    const catStmt = db.prepare('INSERT INTO categories (name, slug, description, image, sort_order, featured) VALUES (?,?,?,?,?,?)');
    let catOrder = 0;
    const catSlugs = new Set();
    for (const c of seed.categories) {
      let slug = slugify(c.slug || c.name);
      if (catSlugs.has(slug)) slug = `${slug}-${++catOrder}`;
      catSlugs.add(slug);
      const info = catStmt.run(c.name, slug, c.description, c.image, catOrder++, 1);
      c._id = info.lastInsertRowid;
    }

    // brands
    const brandStmt = db.prepare('INSERT INTO brands (name, slug, description, image, featured) VALUES (?,?,?,?,?)');
    const brandIds = {};
    for (const b of seed.brands) {
      const slug = ensureUniqueSlug('brands', slugify(b.slug || b.name));
      const info = brandStmt.run(b.name, slug, b.description, b.image, toBool(b.featured) ? 1 : 0);
      brandIds[b.name.toLowerCase()] = info.lastInsertRowid;
    }

    // products
    const pStmt = db.prepare(`
      INSERT INTO products (
        sku, title, slug, brand_id, category_id, main_category, product_type, size,
        description, short_description, price, sale_price, discount_pct, currency, stock,
        status, featured, best_seller, new_arrival, trending, on_sale, rating, review_count,
        tags_json, ingredients_json, benefits_json, how_to_use, skin_types_json, concerns_json,
        images_json, thumbnail, seo_title, seo_description
      ) VALUES (
        @sku, @title, @slug, @brand_id, @category_id, @main_category, @product_type, @size,
        @description, @short_description, @price, @sale_price, @discount_pct, 'BDT', @stock,
        'published', @featured, @best_seller, @new_arrival, @trending, 1, @rating, @review_count,
        @tags_json, @ingredients_json, @benefits_json, @how_to_use, @skin_types_json, @concerns_json,
        @images_json, @thumbnail, @seo_title, @seo_description
      )
    `);
    const vStmt = db.prepare('INSERT INTO variants (product_id, sku, size, price, old_price, stock, image) VALUES (?,?,?,?,?,?,?)');

    seed.products.forEach((p, idx) => {
      const brandId = brandIds[p.brand.toLowerCase()];
      const cat = seed.categories.find(
        (c) => c.name.toLowerCase() === String(p.mainCategory || 'Skincare').toLowerCase().replace('and', '&')
      ) || seed.categories[0];

      const images = [p.imageUrl, ...(p.gallery || [])].filter(Boolean);
      const uniqueImages = [...new Set(images)].slice(0, 6);
      const gallery = uniqueImages.length > 1 ? uniqueImages : [uniqueImages[0] || '', p.imageUrl || ''].filter(Boolean);

      const title = p.title;
      const slug = ensureUniqueSlug('products', slugify(`${p.brand}-${title}`));
      const sku = ensureUniqueSku(p.sku);

      const info = pStmt.run({
        sku,
        slug,
        title,
        brand_id: brandId || null,
        category_id: cat ? cat._id : null,
        main_category: p.mainCategory || 'Skincare',
        product_type: p.productType || p.category || '',
        size: p.size || '',
        description: p.description || '',
        short_description: p.shortDescription || '',
        price: toNum(p.offerPrice),
        sale_price: toNum(p.offerPrice),
        discount_pct: toNum(p.discountPct),
        stock: toNum(p.stock),
        featured: idx < 8 && !/cleanser/i.test(title) && !/mask/i.test(title) ? 1 : 0,
        best_seller: /glow|essence|serum|relief sun|sun/i.test(title) && toNum(p.stock) > 80 ? 1 : 0,
        new_arrival: idx % 3 === 0 ? 1 : 0,
        trending: /snail|glutathione|vitamin|toner/i.test(title) ? 1 : 0,
        rating: clampRating(4.2 + Math.random() * 0.7),
        review_count: Math.floor(Math.random() * 90) + 4,
        tags_json: JSON.stringify(['skincare', ...String(p.tags || '').split(',').filter(Boolean).map((s) => s.trim()).slice(0, 8)]),
        ingredients_json: JSON.stringify(p.ingredients || []),
        benefits_json: JSON.stringify(p.benefits || []),
        how_to_use: p.howToUse || '',
        skin_types_json: JSON.stringify(p.skinTypes || []),
        concerns_json: JSON.stringify(p.concerns || []),
        images_json: JSON.stringify(gallery),
        thumbnail: gallery[0] || '',
        seo_title: `${title} — ${p.brand} | ${STORE_NAME}`,
        seo_description: p.shortDescription || ''
      });

      (p.variants && p.variants.length ? p.variants : [{
        size: p.size, sku, stock: p.stock, price: toNum(p.offerPrice), old_price: toNum(p.oldPrice), image: p.imageUrl
      }]).forEach((v) => {
        vStmt.run(info.lastInsertRowid, v.sku || sku, v.size, toNum(v.price), toNum(v.oldPrice || p.oldPrice), toNum(v.stock), v.image || '');
      });

      // a few seed reviews on first products
      if (idx < 6) {
        const names = ['Ayesha Rahman', 'Sadia Khan', 'Nusrat Jahan', 'Tanvir Ahmed', 'Mithila Chowdhury', 'Farhana Islam'];
        for (let r = 0; r < 3; r++) {
          db.prepare('INSERT INTO reviews (product_id, customer_name, rating, title, text, verified, status, featured) VALUES (?,?,?,?,?,?,?,?)').run(
            info.lastInsertRowid,
            names[(idx + r) % names.length],
            clampRating(4 + Math.random() * 1),
            r % 2 ? 'Lovely texture' : 'Worth every taka',
            'Absolutely love how my skin feels after using this. Fast delivery, genuine product and beautiful packaging. Highly recommended!',
            r > 0 ? 1 : 0,
            'approved',
            r === 0 ? 1 : 0
          );
        }
      }
    });

    // banners
    const bStmt = db.prepare('INSERT INTO banners (eyebrow, title, description, button_text, link, image, sort_order, enabled, start_date, end_date) VALUES (?,?,?,?,?,?,?,?,?,?)');
    (seed.banners || []).slice(0, 6).forEach((b, i) => {
      bStmt.run(b.eyebrow, b.title, b.description, b.buttonText, b.link, b.image, i + 1, 1, b.startDate, b.endDate);
    });

    // journal articles
    const artStmt = db.prepare('INSERT INTO articles (title, slug, category, author, cover, excerpt, content, tags_json, published) VALUES (?,?,?,?,?,?,?,?,?)');
    const articles = [
      {
        title: 'The Rice Water Ritual: Brightening from the First Wash',
        category: 'Routine',
        author: 'Editorial Team',
        cover: 'https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?w=1200&auto=format',
        excerpt: 'Rice water has been a Korean beauty staple for generations. Here is how to layer rice-powered skincare into your everyday ritual.',
        content: 'Rice water is rich in vitamins, minerals and amino acids that help skin feel softer and look brighter. Start with a rice-based foaming cleanser, follow with a rice toner, and seal everything in with a rice ceramide cream for a dewy, glass-skin finish. Patience is the key — visible change comes from consistency.',
        tags: ['rice', 'brightening', 'korean']
      },
      {
        title: 'SPF Decoded: Choosing the Right Sunscreen for Bondhan Season',
        category: 'Ingredient Guide',
        author: 'Editorial Team',
        cover: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=1200&auto=format',
        excerpt: 'SPF 30 or 50? Chemical or mineral? We break down everything you need to know to pick your perfect daily sunscreen.',
        content: 'Look for a broad-spectrum SPF 50 PA++++ for daily wear in humid climates. Gel or watery textures layer beautifully under makeup without heaviness, while rice- and panthenol-infused formulas soothe as they protect. Apply two finger lengths across the face and neck every morning — rain or shine.',
        tags: ['sunscreen', 'spf', 'sun care']
      },
      {
        title: 'Snail Mucin, Explained: The 96% Essence Cult Classic',
        category: 'Ingredient Guide',
        author: 'Editorial Team',
        cover: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=1200&auto=format',
        excerpt: 'The internet is obsessed. We explain why snail mucin has earned its place in routines from Seoul to Dhaka.',
        content: 'Snail secretion filtrate is prized for delivering a rich dose of hydrating glycoproteins, hyaluronic acid and glycolic acid. The 96% mucin essence has a light, stringy texture that layers beautifully. It suits most skin types and pairs well after the toner step, before heavier creams.',
        tags: ['snail mucin', 'hydration', 'essence']
      },
      {
        title: '7-Step Glass Skin Routine for Humid Weather',
        category: 'Routine',
        author: 'Editorial Team',
        cover: 'https://images.unsplash.com/photo-1556228852-6d35a585d566?w=1200&auto=format',
        excerpt: 'A realistic, seven-step evening routine built for Bangladeshi humidity — without the heavy finish.',
        content: 'Double cleanse to melt sunscreen, tone with a clarifying formula, pat in an essence, layer a brightening serum like niacinamide, apply a light ampoule, then finish with a gel cream or milk moisturizer. Adjust textures by season and keep SPF on during the day.',
        tags: ['routine', 'glass skin', 'skincare']
      }
    ];
    articles.forEach((a) => {
      artStmt.run(a.title, slugify(a.title), a.category, a.author, a.cover, a.excerpt, a.content, JSON.stringify(a.tags), 1);
    });

    // faqs
    const fStmt = db.prepare('INSERT INTO faqs (question, answer, section, sort_order) VALUES (?,?,?,?)');
    const faqs = [
      ['Are your products 100% authentic?', 'Yes. Every product is sourced through authorized distributors and verified before being listed. Authenticity is the foundation of what we do.', 'general', 1],
      ['How long does delivery take?', 'Inside Dhaka: 1–2 working days. Outside Dhaka: 2–4 working days. Orders placed before 3 PM usually ship the same day.', 'shipping', 2],
      ['What is the delivery charge?', 'Delivery inside Dhaka is ৳60 and outside Dhaka is ৳120.', 'shipping', 3],
      ['Which payment methods do you accept?', 'We accept Cash on Delivery, bKash and Nagad. Our payment team will confirm your order over the phone after you place it.', 'payment', 4],
      ['How do I track my order?', 'Use the Order Tracking page and enter your Order ID or your phone number to see the live status of your order.', 'orders', 5],
      ['Can I return or exchange a product?', 'Unopened, unused products can be returned within 7 days of delivery. Please reach out to our support team to arrange a return.', 'returns', 6],
      ['How do I find the right products for my skin?', 'Try our "Find Your Routine" quiz — answer a few questions and we will recommend a personalized routine built around your skin type and concerns.', 'general', 7]
    ];
    faqs.forEach(([q, a, s, o]) => {
      fStmt.run(q, a, s, o);
    });

    // routine questions
    const rqStmt = db.prepare('INSERT INTO routine_questions (question, subtitle, multiple, sort_order) VALUES (?,?,?,?)');
    const roStmt = db.prepare('INSERT INTO routine_options (question_id, label, value, sort_order) VALUES (?,?,?,?)');
    const rrStmt = db.prepare('INSERT INTO routine_results (option_id, category, tags_json, product_ids_json) VALUES (?,?,?,?)');
    const questions = [
      { q: 'What is your skin type?', sub: 'Choose the one that describes your skin most days.', multiple: 0, opts: [['Dry', 'dry'], ['Oily', 'oily'], ['Combination', 'combination'], ['Normal', 'normal'], ['Sensitive', 'sensitive']] },
      { q: 'What is your main skin concern?', sub: 'Pick what you want to improve the most.', multiple: 1, opts: [['Dark spots & uneven tone', 'brightening'], ['Acne & breakouts', 'acne'], ['Dullness & low glow', 'glow'], ['Dryness & dehydration', 'hydration'], ['Lines & elasticity', 'aging'], ['Oil & big pores', 'pores']] },
      { q: 'How would you describe your daily routine?', sub: 'How much time can you spend on your skin?', multiple: 0, opts: [['Just the basics (3 steps)', 'minimal'], ['A complete routine (5–7 steps)', 'full'], ['I love sheet masks & extras', 'pampering']] },
      { q: 'What is your preferred budget?', sub: 'Price is only one factor — quality stays high.', multiple: 0, opts: [['Value focused', 'budget'], ['Mid-range', 'mid'], ['Premium / luxury', 'premium']] }
    ];
    const productIds = {
      brightening: [],
      hydration: [],
      glow: [],
      sun: [],
      calming: []
    };
    const all = db.prepare('SELECT id, title, brand_id FROM products').all();
    for (const p of all) {
      let tags = [];
      try { tags = JSON.parse(db.prepare('SELECT tags_json t FROM products WHERE id=?').get(p.id).t); } catch {}
      const t = `${p.title} ${tags.join(' ')}`.toLowerCase();
      if (/(bright|glow|whiten|tone|vitamin|niacinamide|glutathione|dark spot)/.test(t)) productIds.brightening.push(p.id);
      if (/(hydrat|hyaluron|moistur|ceramide|essence|snail)/.test(t)) productIds.hydration.push(p.id);
      if (/(sun|uv|spf)/.test(t)) productIds.sun.push(p.id);
      if (/(calm|relief|sooth|green tea|centella)/.test(t)) productIds.calming.push(p.id);
      if (/(salicylic|glycolic|pore|toner|cleanser)/.test(t)) {}
    }
    const tagMap = { brightening: ['brightening'], acne: ['acne'], glow: ['glow'], hydration: ['hydration'], aging: ['aging'], pores: ['pores'], minimal: ['cleanser'], full: ['serum'], pampering: ['mask'], budget: [], mid: [], premium: [] };

    questions.forEach((qq, qi) => {
      const qinfo = rqStmt.run(qq.q, qq.sub, qq.multiple, qi + 1);
      qq.opts.forEach(([label, value], oi) => {
        const oinfo = roStmt.run(qinfo.lastInsertRowid, label, value, oi + 1);
        let ids = productIds[value] || all.map((p) => p.id);
        if (tagMap[value] && tagMap[value].length) {
          const matched = all.filter((p) => db.prepare('SELECT tags_json t FROM products WHERE id=?').get(p.id).t.toLowerCase().includes(tagMap[value][0]));
          if (matched.length) ids = matched.map((p) => p.id);
        }
        rrStmt.run(oinfo.lastInsertRowid, value, JSON.stringify(tagMap[value] || []), JSON.stringify([...ids].slice(0, 12)));
      });
    });

    // admin user
    const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    db.prepare('INSERT INTO admins (name, email, password_hash, role) VALUES (?,?,?,?)').run('Store Owner', ADMIN_EMAIL, passwordHash, 'admin');
    db.prepare('INSERT INTO admins (name, email, password_hash, role) VALUES (?,?,?,?)').run('Content Editor', 'editor@petalrose.com', bcrypt.hashSync('Editor@123', 10), 'editor');
    db.prepare('INSERT INTO admins (name, email, password_hash, role) VALUES (?,?,?,?)').run('Order Manager', 'orders@petalrose.com', bcrypt.hashSync('Orders@123', 10), 'order_manager');
  });

  tx();

  seedSettings();
  console.log(`[seed] Seeded ${productCount}->${db.prepare('SELECT COUNT(*) c FROM products').get().c} products.`);
}

function seedSettings() {
  const set = db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  const defaults = {
    store: JSON.stringify({
      name: STORE_NAME,
      tagline: 'Beauty, curated for you.',
      logo: '',
      favicon: '',
      phone: '+880 1874 460244',
      email: 'hello@petalrose.com',
      address: 'Level 3, House 12, Road 5, Gulshan 1, Dhaka 1212',
      currency: 'BDT',
      socials: { facebook: '', instagram: '', tiktok: '', whatsapp: '8801874460244', x: '' }
    }),
    shipping: JSON.stringify({
      insideFee: 60,
      outsideFee: 120,
      freeThreshold: 2500,
      methods: ['inside', 'outside']
    }),
    payment: JSON.stringify({
      methods: [
        { id: 'cod', label: 'Cash on Delivery', enabled: true, instruction: 'Pay in cash when your order arrives.' },
        { id: 'bkash', label: 'bKash', enabled: true, number: '', instruction: 'Send payment to the bKash number shown during checkout and share the TrxID in the notes.' },
        { id: 'nagad', label: 'Nagad', enabled: true, number: '', instruction: 'Send payment to the Nagad number shown during checkout and share the TrxID in the notes.' },
        { id: 'card', label: 'Online Payment', enabled: false, instruction: 'Pay securely using your card through our gateway.' }
      ]
    }),
    tax: JSON.stringify({ enabled: false, rate: 0, label: 'VAT' }),
    notifications: JSON.stringify({ newOrder: true, lowStock: true, newReview: true, orderShipped: true, orderDelivered: true, orderCancelled: true, lowStockThreshold: 10 }),
    seo: JSON.stringify({
      siteTitle: `${STORE_NAME} — Luxury Skincare & Beauty`,
      metaDescription: `${STORE_NAME} — authentic Korean skincare and beauty essentials, curated for glowing, healthy skin.`,
      ogImage: '',
      googleVerification: '',
      sitemap: true
    }),
    hero: JSON.stringify({
      enabled: true,
      eyebrow: 'Authentic Beauty · Carefully Curated',
      heading: 'Beauty, Curated For You',
      description: 'Discover skincare and beauty essentials selected to elevate your everyday routine.',
      primaryCta: 'Shop Collection',
      primaryLink: '/shop',
      secondaryCta: 'Explore Best Sellers',
      secondaryLink: '/shop?sort=best',
      image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1400&auto=format'
    }),
    routineIntro: JSON.stringify({ eyebrow: 'Find Your Routine', heading: 'A routine built around you', description: 'Answer a few questions and we will curate the perfect beauty shelf for your skin.' })
  };
  for (const [k, v] of Object.entries(defaults)) set.run(k, v);
}

module.exports = { seedIfEmpty, seedSettings, ensureUniqueSlug, ensureUniqueSku };

if (require.main === module) {
  seedIfEmpty();
  console.log('Seed complete. Admin login:', `${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}