const LOGOS = import.meta.glob('../images/brands/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' });

const OVERRIDES = {
  'av-ne': 'AVNE', 'cps': 'CPS', 'e-l-f': 'E.L.F.', 'honey': 'Honey', 'i-m-from': "I'm From", 'k18': 'K18',
  'so': 'SO', 'setscale': 'S.E.T. Scale', '3w-clinic': '3W Clinic', 'axis-y': 'Axis-y', 'beauty-of-joseon': 'Beauty of Joseon',
  'dr-sheth-s': "Dr Sheth's", 'johnson-s': "Johnson's", 'l-oreal-paris': "L'Oréal Paris", 'nature-s-bounty': "Nature's Bounty",
  'o-keeffe-s': "O'Keeffe's", 'palmer-s': "Palmer's", 'pond-s': "Pond's", 'the-derma-co': 'The Derma Co', 'the-face-shop': 'The Face Shop',
  'the-inkey-list': 'The INKEY List', 'the-ordinary': 'The Ordinary', 'victoria-s-secret': "Victoria's Secret", 'dunhill': 'Dunhill',
  'farmacy': 'Farmacy', 'lmltop': 'Lmltop', 'maange': 'Maange', 'raip': 'Raip', 'sasi': 'Sasi', 'tia-m': 'Tia-M', 'vgr': 'VGR',
  'nella-fantasia': 'Nella Fantasia', 'nicka-k-new-york': 'Nicka K', 'snake-brand': 'Snake Brand', 'preorder': 'Preorder',
  'uncategorized': 'Uncategorized', 'k-secret-cosmetics': 'K Secret Cosmetics', 'kota-cosmetics': 'Kota Cosmetics',
  'kracie-hadabisei': 'Kracie Hadabisei', 'kumano-cosme': 'Kumano Cosme', 'kobayashi-pharmaceutical': 'Kobayashi Pharmaceuticals',
  'rohto-mentholatum': 'Rohto Mentholatum', 'shiseido-annesa': 'Shiseido Anessa', 'beauty-formulas': 'Beauty Formulas',
  'combo-pack-by-klassy-missy': 'Klassy Missy', 'the-rose-company': 'The Rose Company'
};

export const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const titleCase = (s) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function displayName(base) {
  if (OVERRIDES[base]) return OVERRIDES[base];
  return titleCase(base);
}

export function brandRows(brands) {
  const dbByKey = new Map();
  const set = (key, b) => {
    const cur = dbByKey.get(key);
    if (!cur || (Number(b.productCount) > 0 && Number(cur.productCount) === 0)) dbByKey.set(key, b);
  };
  for (const b of brands || []) {
    set(normalize(b.slug), b);
    set(normalize(b.name), b);
  }
  return Object.entries(LOGOS).map(([path, url]) => {
    const base = path.split('/').pop().replace(/\.(jpg|jpeg|png|webp)$/i, '');
    const db = dbByKey.get(normalize(base));
    const name = db && db.name ? db.name : displayName(base);
    return {
      key: base,
      url,
      name,
      count: db ? Number(db.productCount || 0) : null,
      slug: db ? db.slug : null,
      href: db ? `/shop?brand=${encodeURIComponent(db.slug)}` : `/shop?q=${encodeURIComponent(name)}`
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}