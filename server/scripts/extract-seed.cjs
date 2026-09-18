const fs = require('fs');
const path = require('path');

const RAW = path.join(__dirname, 'products.json');
const OUT = path.join(__dirname, '..', 'data', 'seed-data.json');

if (!fs.existsSync(RAW)) {
  console.error('Missing raw file. Run: Invoke-WebRequest from glowsaffron API -> products.json');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(RAW, 'utf8'));
const products = raw.products || [];

function clean(v) {
  return String(v ?? '').trim().replace(/\s+/g, ' ');
}

function extractSection(text, phrases) {
  const lower = String(text || '');
  for (const p of phrases) {
    const idx = lower.toLowerCase().indexOf(p.toLowerCase());
    if (idx >= 0) {
      let seg = text.slice(idx);
      seg = seg.split('\n').slice(1).join('\n').trim();
      const cut = seg.search(/\n[A-Z][a-zA-Z ]+:\n/);
      if (cut > 0) seg = seg.slice(0, cut);
      return clean(seg).replace(/\n+/g, ' ').split(/•|(?:\n)|(?:\s-\s)/).map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

const CATEGORY_MAP = {
  Cleanser: 'Skincare',
  Cream: 'Skincare',
  Sunscreen: 'Sun Care',
  Serum: 'Skincare',
  Mask: 'Skincare',
  Oil: 'Skincare',
  Ampoule: 'Skincare',
  Toner: 'Skincare',
  Essence: 'Skincare',
  'Eye Cream': 'Skincare',
  Booster: 'Skincare'
};

// group variants (same title+brand), build product list
const byKey = {};
for (const p of products) {
  const key = `${clean(p.brand).toLowerCase()}::${clean(p.title).toLowerCase()}`;
  if (!byKey[key]) byKey[key] = [];
  byKey[key].push(p);
}

const DERIVED_PRICE_BY_BRAND = {
  'beauty of joseon': 1299, 'skin1004': 999, 'the ordinary': 999, 'axis-y': 1090,
  'the face shop': 799, 'missha': 880, 'dabo': 700, 'cosrx': 1300, 'farmstay': 999,
  'nature skin': 520, 'beaute': 700, 'im from': 1250, 'arencia': 1300, '3w clinic': 600,
  'tiam': 950, 'celimax': 1200
};

const nativeDescriptions = {};
for (const p of products) {
  const base = clean(p.title).toLowerCase();
  const brand = clean(p.brand);
  nativeDescriptions[clean(p.title)] = {
    ingredients: extractSection(p.description, ['Ingredients:']),
    benefits: extractSection(p.description, ['Benefits:']).filter(s => !/^[\u0980-\u09FF]/.test(s)),
    howToUse: extractSection(p.description, ['How to Use:']).filter(s => !/^[\u0980-\u09FF]/.test(s)),
    faq: extractSection(p.description, ['FAQ:']).filter(s => !/^[\u0980-\u09FF]/.test(s))
  };
  if (base.includes('snail')) nativeDescriptions[clean(p.title)].ingredients = ['Snail Secretion Filtrate 96%', 'Betaine', 'Sodium Hyaluronate', 'Arginine', 'Allantoin', 'Panthenol'];
  if (base.includes('vitamin') || base.includes('glow')) nativeDescriptions[clean(p.title)].ingredients = ['Niacinamide', 'Vitamin C (Ascorbic Acid)', 'Zinc PCA', 'Hyaluronic Acid', 'Glycerin'];
  if (base.includes('sun') || base.includes('uv')) nativeDescriptions[clean(p.title)].ingredients = ['Zinc Oxide', 'Ethylhexyl Triazone', 'Niacinamide', 'Rice Extract', 'Glycerin'];
  if (base.includes('rice')) nativeDescriptions[clean(p.title)].ingredients = ['Rice Water', 'Rice Bran Oil', 'Saponaria Officinalis Extract', 'Glycerin', 'Ceramide NP'];
  if (base.includes('centella')) nativeDescriptions[clean(p.title)].ingredients = ['Centella Asiatica Extract', 'Hyaluronic Acid', 'Niacinamide', 'Madecassoside', 'Glycerin'];
  if (base.includes('glutathione')) nativeDescriptions[clean(p.title)].ingredients = ['Glutathione', 'Niacinamide', 'Tranexamic Acid', 'Shea Butter', 'Vitamin E'];
  if (base.includes('tone up')) nativeDescriptions[clean(p.title)].ingredients = ['Titanium Dioxide', 'Niacinamide', 'Arbutin', 'Glutathione', 'Glycerin'];
  if (base.includes('glycolic')) nativeDescriptions[clean(p.title)].ingredients = ['Glycolic Acid 7%', 'Ginseng Root Extract', 'Allantoin', 'Amino Acids'];
  if (base.includes('green tea')) nativeDescriptions[clean(p.title)].ingredients = ['Green Tea Extract', 'Panthenol', 'Centella Asiatica', 'Tea Tree Leaf Extract'];
  if (base.includes('honey')) nativeDescriptions[clean(p.title)].ingredients = ['Rice Bran', 'Honey Extract', 'Propolis Extract', 'Royal Jelly'];
  if (base.includes('snail') && base.includes('96')) nativeDescriptions[clean(p.title)].ingredients = ['Snail Secretion Filtrate 96%', 'Betaine', 'Sodium Hyaluronate', 'Arginine', 'Panthenol'];
}

const TITLES = {
  cleanser: { short: 'A gentle yet effective cleanser that lifts away impurities, excess sebum and makeup residue while leaving skin soft, comfortable and balanced.', benefit: 'Deep cleansing', use: 'Massage a small amount onto damp skin in gentle circular motions, then rinse thoroughly with lukewarm water. Use morning and evening.' },
  cream: { short: 'A nourishing cream that floods skin with moisture and helps strengthen the skin barrier for a plump, healthy-looking complexion.', benefit: 'Deep hydration', use: 'After serum, apply an even layer over the face and neck, gently pressing into skin until fully absorbed. Use morning and evening as the final step.' },
  sunscreen: { short: 'A weightless, fast-absorbing daily sunscreen offering powerful broad-spectrum protection without white cast or stickiness.', benefit: 'Broad-spectrum UV protection', use: 'As the last step of your morning routine, apply an adequate amount evenly over face and neck. Reapply every 2–3 hours when outdoors.' },
  serum: { short: 'A concentrated treatment serum formulated to target your key skincare concerns with visible, results-driven actives.', benefit: 'Targeted treatment', use: 'After toning, dispense 2-3 drops and press gently into skin. Follow with moisturizer. Use in the morning or evening as directed.' },
  mask: { short: 'A pampering wash-off mask that drenches skin with conditioning actives for an instant refreshed, radiant finish.', benefit: 'Instant radiance', use: 'Apply an even layer to clean dry skin, leave on for 15–20 minutes, then rinse with lukewarm water. Use 1–2 times a week.' },
  oil: { short: 'A silky cleansing oil that melts away makeup and sunscreen while keeping the skin barrier soft and supple.', benefit: 'Makeup melting cleanse', use: 'Massage dry hands and apply to dry skin, emulsify with water to a milk, then rinse and follow with a water-based cleanser.' },
  ampoule: { short: 'A lightweight concentrated ampoule that delivers a high dose of potent actives to visibly improve skin tone and texture.', benefit: 'Concentrated actives', use: 'Apply a few drops after toner over the whole face, pressing gently into skin. Seal with a moisturizer.' },
  toner: { short: 'A refreshing toner that rebalances skin, preps it for the rest of your routine and improves the look of texture and pores.', benefit: 'Balance & prep', use: 'Soak a cotton pad and sweep across face after cleansing, or pat in with palms. Follow with serum and moisturizer.' },
  essence: { short: 'A lightweight hydrating essence that layers moisture into skin and preps it to absorb the rest of your routine.', benefit: 'Hydration boost', use: 'Pat 2–3 drops onto skin right after toning, then layer your serum and moisturizer on top.' },
  'eye cream': { short: 'A dedicated eye treatment that hydrates, firms and brightens the delicate eye area for a refreshed look.', benefit: 'Eye-area care', use: 'Take a rice-grain amount, warm between fingertips and tap gently around the eye area morning and evening.' },
  booster: { short: 'A treatment booster that primes skin with a burst of potent actives ahead of your daily serums and creams.', benefit: 'Potency boost', use: 'Apply a few drops to freshly cleansed skin, allow to absorb, then continue with your remaining routine.' }
};

const SKINTYPES_ALL = ['Dry', 'Oily', 'Combination', 'Normal', 'Sensitive'];
const SENSITIVE_TITLES = ['snail', 'centella', 'green tea', 'calming', 'relief', 'rice and honey'];

function deriveConcern(title) {
  const t = clean(title).toLowerCase();
  const c = [];
  if (/(bright|glow|whitening|tone|vitamin|niacinamide|glutathione|dark spot)/.test(t)) c.push('Brightening');
  if (/(hydrat|hyaluron|moistur|ceramide|essence)/.test(t)) c.push('Hydration');
  if (/(sun|uv|spf)/.test(t)) c.push('Sun Protection');
  if (/(retinal|anti|firm|collagen)/.test(t)) c.push('Anti-Aging');
  if (/(pore|oil|balancing)/.test(t)) c.push('Oil Control');
  if (/(calm|relief|sooth|green tea|centella)/.test(t)) c.push('Soothing');
  if (/(salicylic|acne|clarify|glycolic)/.test(t)) c.push('Acne & Texture');
  if (!c.length) c.push('Hydration');
  return c;
}

const productsOut = [];
for (const [key, list] of Object.entries(byKey)) {
  list.sort((a, b) => (Number(a.size.match(/\d+/)?.[0]) || 0) - (Number(b.size.match(/\d+/)?.[0]) || 0));
  const primary = list[0];
  const title = clean(primary.title);
  const upper = title.charAt(0).toUpperCase() + title.slice(1);
  let brand = clean(primary.brand);
  const category = clean(primary.category);
  const mainCat = CATEGORY_MAP[category] || 'Skincare';
  const lower = title.toLowerCase();
  const tpl = Object.entries(TITLES).find(([k]) => lower.includes(k))?.[1] || TITLES.serum;

  const hasPrices = list.some((v) => Number(v.oldPrice) > 0 && Number(v.offerPrice) > 0);
  let oldPrice, offerPrice;
  if (hasPrices) {
    oldPrice = Math.max(...list.map((v) => Number(v.oldPrice) || 0));
    offerPrice = list.map((v) => (Number(v.offerPrice) || 0)).filter(Boolean)[0] || Math.round(oldPrice * 0.8);
  } else {
    offerPrice = DERIVED_PRICE_BY_BRAND[brand.toLowerCase()] || 899;
    oldPrice = offerPrice + Math.round(offerPrice * 0.3);
  }
  let discountPct = Math.round(((oldPrice - offerPrice) / oldPrice) * 100);
  if (discountPct < 5) { oldPrice = Math.round((offerPrice * 1.18) / 10) * 10; discountPct = Math.round(((oldPrice - offerPrice) / oldPrice) * 100); }

  const slug = `${[brand, title].join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
  const stock = list.reduce((s, v) => s + (Number(v.stockQty) || 0), 0);
  const nat = nativeDescriptions[clean(primary.title)] || {};

  const skinTypes = lower === 'cleanser' || lower.includes('cleanser') ? SKINTYPES_ALL : SKINTYPES_ALL;
  const img = clean(primary.imageUrl) || '';

  productsOut.push({
    title: upper,
    brand,
    category,
    mainCategory: mainCat,
    productType: category,
    size: clean(primary.size),
    sku: clean(primary.sku) || `${brand.replace(/\s/g, '-').toUpperCase()}-${slug.slice(0, 10)}-01`,
    oldPrice,
    offerPrice,
    discountPct,
    stock,
    imageUrl: img,
    gallery: list.map((v) => clean(v.imageUrl)).filter(Boolean),
    tags: (clean(primary.tags) || '').split(',').map((s) => s.trim()).filter(Boolean),
    shortDescription: tpl.short,
    description: `${upper} by ${brand} — a ${category.toLowerCase()} curated for the modern skincare routine. ${tpl.short} Presented in a ${clean(primary.size)} size for consistent, everyday use.`,
    benefits: [tpl.benefit, 'Improves overall skin tone & texture', 'Suitable for daily use', ...(nat.benefits.length ? nat.benefits.slice(0, 2) : [])],
    howToUse: nat.howToUse[0] || tpl.use,
    ingredients: nat.ingredients.length ? nat.ingredients.slice(0, 8) : tpl.benefit === 'Deep cleansing' ? ['Water', 'Glycerin', 'Coconut-derived Cleansers', 'Centella Complex', 'Fragrance-Free Formula'] : ['Glycerin', 'Niacinamide', 'Hyaluronic Acid', 'Water', 'Botanical Extracts'],
    skinTypes,
    concerns: deriveConcern(title),
    faq: [
      { q: `Is ${title} authentic?`, a: `Yes — every item is sourced from authorized distributors and verified for authenticity before dispatch.` },
      { q: `Who is ${title} suitable for?`, a: `Formulated for ${skinTypes.slice(0, 3).join(', ').toLowerCase()} skin. Patch test first if you have very sensitive skin.` },
      { q: 'What is the delivery time?', a: 'Inside Dhaka 1–2 working days, outside Dhaka 2–4 working days after confirmation.' }
    ],
    variants: list.map((v) => ({
      size: clean(v.size),
      sku: clean(v.sku),
      stock: Number(v.stockQty) || 0,
      price: (Number(v.offerPrice) || 0) || offerPrice,
      oldPrice: Number(v.oldPrice) || oldPrice,
      image: clean(v.imageUrl) || img
    }))
  });
}

// brands
const BRAND_LOGOS = {
  'The Face Shop': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/The_Face_Shop_logo.png/320px-The_Face_Shop_logo.png',
};
const brands = [...new Set(productsOut.map((p) => p.brand))].map((name, i) => ({
  name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  description: `${name} — a curated skincare label trusted for high-quality, results-driven beauty products.`,
  image: `https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&auto=format`,
  featured: i < 8
}));

// categories
const CATEGORY_META = {
  Skincare: { desc: 'Cleansers, serums, toners and creams designed to build a healthy, glowing complexion.', img: 'https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?w=900&auto=format' },
  Makeup: { desc: 'Foundations, BB creams and color essentials for a flawless, natural finish.', img: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=900&auto=format' },
  'Hair Care': { desc: 'Shampoos, masks and treatments that nourish hair from root to tip.', img: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=900&auto=format' },
  'Body Care': { desc: 'Body lotions, scrubs and bath essentials for soft, cared-for skin.', img: 'https://images.unsplash.com/photo-1556228852-6d35a585d566?w=900&auto=format' },
  Fragrance: { desc: 'Scented favorites to layer into your daily beauty ritual.', img: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=900&auto=format' },
  'Lip Care': { desc: 'Tinted balms and treatments for soft, healthy lips.', img: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=900&auto=format' },
  'Sun Care': { desc: 'Everyday SPF heroes that protect without heaviness or white cast.', img: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=900&auto=format' },
  'Beauty Tools': { desc: 'Tools and accessories to elevate your at-home routine.', img: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=900&auto=format' }
};

const categories = Object.entries(CATEGORY_META).map(([name, meta], i) => ({
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  description: meta.desc,
  image: meta.img,
  sortOrder: i + 1
}));

const seed = {
  meta: { source: raw.config },
  categories,
  brands,
  products: productsOut,
  banners: (raw.offers || []).map((o, i) => ({
    eyebrow: o.eyebrow,
    title: (o.title || '').replace(/\*/g, ''),
    description: o.description,
    buttonText: o.buttonText,
    image: o.imageUrl,
    link: o.link ? `/products/${o.link}` : '/shop',
    enabled: true,
    sortOrder: i + 1,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: null
  }))
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(seed, null, 2));
console.log(`Wrote ${productsOut.length} products, ${brands.length} brands, ${categories.length} categories, ${seed.banners.length} banners -> ${OUT}`);