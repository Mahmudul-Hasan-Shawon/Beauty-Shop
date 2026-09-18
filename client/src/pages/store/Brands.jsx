import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';

const LOGOS = import.meta.glob('../../images/brands/*.{jpg,jpeg,png,webp}', { eager: true, query: '?url', import: 'default' });

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

const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const titleCase = (s) => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function displayName(base) {
  if (OVERRIDES[base]) return OVERRIDES[base];
  return titleCase(base);
}

function initial(name) {
  const m = String(name || '').match(/[A-Za-z0-9]/);
  return m ? m[0].toUpperCase() : '#';
}

export default function Brands() {
  const [brands, setBrands] = useState([]);
  const [q, setQ] = useState('');
  const [letter, setLetter] = useState(null);

  useEffect(() => {
    api.get('/api/brands').then((r) => setBrands(r.data || [])).catch(() => {});
  }, []);

  const dbByKey = useMemo(() => {
    const map = new Map();
    const set = (key, b) => {
      const cur = map.get(key);
      if (!cur || (b.productCount > 0 && cur.productCount === 0)) map.set(key, b);
    };
    for (const b of brands) {
      set(normalize(b.slug), b);
      set(normalize(b.name), b);
    }
    return map;
  }, [brands]);

  const list = useMemo(() => {
    return Object.entries(LOGOS).map(([path, url]) => {
      const base = path.split('/').pop().replace(/\.(jpg|jpeg|png|webp)$/i, '');
      const name = displayName(base);
      const db = dbByKey.get(normalize(base));
      return {
        key: base,
        url,
        name: db && db.name ? db.name : name,
        count: db ? Number(db.productCount || 0) : null,
        slug: db ? db.slug : null,
        href: db ? `/shop?brand=${encodeURIComponent(db.slug)}` : `/shop?q=${encodeURIComponent(name)}`
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [dbByKey]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? list.filter((b) => b.name.toLowerCase().includes(s) || b.key.includes(s)) : list;
  }, [list, q]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const b of filtered) {
      const L = initial(b.name);
      if (!map.has(L)) map.set(L, []);
      map.get(L).push(b);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const letters = useMemo(() => groups.map(([L]) => L), [groups]);

  const jump = (L) => {
    setLetter(L);
    if (L) {
      setTimeout(() => {
        const el = document.getElementById(`bl-${L}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  };

  const visibleGroups = letter ? groups.filter(([L]) => L === letter) : groups;

  return (
    <div>
      <div className="page-head">
        <div className="breadcrumb">Brands</div>
        <h1>The Brands We <em>Carry</em></h1>
        <p>Every product on Petal &amp; Rose comes from these authentic, trusted global brands — sourced directly and checked before it reaches you.</p>
      </div>

      <div className="container brands-page">
        <div className="brands-tools">
          <div className="brands-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input type="search" aria-label="Search brands" placeholder="Search brands" value={q}
              onChange={(e) => { setQ(e.target.value); setLetter(null); }} />
            {q && <button type="button" aria-label="Clear search" onClick={() => setQ('')}><i className="fa-solid fa-xmark" /></button>}
          </div>
          <div className="brands-letters" role="tablist" aria-label="Jump to letter">
            <button type="button" className={letter === null ? 'on' : ''} onClick={() => jump(null)}>All</button>
            {letters.map((L) => (
              <button key={L} type="button" className={letter === L ? 'on' : ''} aria-pressed={letter === L} onClick={() => jump(L)}>{L}</button>
            ))}
          </div>
        </div>

        {visibleGroups.length === 0 && <p className="brands-empty">No brands match “{q}”.</p>}

        {visibleGroups.map(([L, items]) => (
          <section key={L} className="brands-group" id={`bl-${L}`}>
            <h3 className="brands-letter">{L}</h3>
            <div className="brands-grid">
              {items.map((b) => (
                <Link key={b.key} to={b.href} className="brand-card" title={b.name} aria-label={b.name}>
                  <span className="brand-logo"><img src={b.url} alt={`${b.name} logo`} loading="lazy" /></span>
                  <span className="brand-name">{b.name}{b.count != null && <span className="brand-count">{b.count}</span>}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <p className="brands-cap">{(filtered.length || list.length)}+ authentic brands — can't find one? <Link to="/contact">Ask us to source it</Link></p>
      </div>
    </div>
  );
}