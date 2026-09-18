import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';

const MAIN_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Shop All', href: '/shop' },
  { label: 'Brands', href: '/brands' },
  { label: 'Journal', href: '/journal' },
  { label: 'Routine Finder', href: '/routine' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Track Your Order', href: '/track' },
  { label: 'Contact Us', href: '/contact' }
];

const SUPPORT_LINKS = [
  { label: 'About Us', href: '/page/about' },
  { label: 'Shipping & Delivery', href: '/page/shipping' },
  { label: 'Returns & Refunds', href: '/page/returns' },
  { label: 'Privacy Policy', href: '/page/privacy' },
  { label: 'Terms & Conditions', href: '/page/terms' }
];

const linkLabel = (s) => String(s || '').trim();

const letterOf = (s) => {
  const c = linkLabel(s).charAt(0).toUpperCase();
  return /[a-z]/i.test(c) ? c : '#';
};

const groupByLetter = (list) => {
  const sorted = [...list].sort((a, b) => linkLabel(a.label).localeCompare(linkLabel(b.label), 'en', { numeric: true }));
  const groups = [];
  for (const item of sorted) {
    const letter = letterOf(item.label);
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.links.push(item);
    else groups.push({ letter, links: [item] });
  }
  return groups;
};

function LinkRow({ item }) {
  return (
    <Link to={item.href} className="smap-row">
      <span className="smap-row-label">{item.label}</span>
      <i className="fa-solid fa-arrow-right" aria-hidden="true" />
    </Link>
  );
}

function FlatGroup({ title, description, links }) {
  return (
    <div className="smap-group">
      <div className="eyebrow smap-group-eyebrow">{title}</div>
      {description && <p className="smap-desc">{description}</p>}
      <div className="smap-list">
        {links.map((l) => <LinkRow key={`${l.href}-${l.label}`} item={l} />)}
      </div>
    </div>
  );
}

function LetterGroup({ title, description, links }) {
  const groups = groupByLetter(links);
  return (
    <div className="smap-group">
      <div className="eyebrow smap-group-eyebrow">{title}</div>
      {description && <p className="smap-desc">{description}</p>}
      <div className="smap-columns">
        {groups.map((g) => (
          <div key={g.letter} className="smap-col-block">
            <div className="smap-col-head">
              <span className="smap-letter">{g.letter}</span>
              <span className="smap-col-line" />
            </div>
            <div className="smap-list">
              {g.links.map((l) => <LinkRow key={`${l.href}-${l.label}`} item={l} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Sitemap() {
  const [cats, setCats] = useState([]);
  const [brands, setBrands] = useState([]);
  const [journal, setJournal] = useState([]);

  useEffect(() => {
    api.get('/api/categories').then((r) => setCats(r.data || [])).catch(() => {});
    api.get('/api/brands').then((r) => setBrands((r.data || []).filter((b) => b.productCount > 0))).catch(() => {});
    api.get('/api/journal').then((r) => setJournal(r.data || [])).catch(() => {});
  }, []);

  const catLinks = cats.map((c) => ({ label: c.name, href: `/shop?category=${c.slug}` }));
  const brandLinks = brands.map((b) => ({ label: b.name, href: `/shop?brand=${b.slug}` }));
  const journalLinks = journal.map((a) => ({ label: a.title, href: `/journal/${a.slug}` }));

  return (
    <div className="container">
      <div className="legal-hero smap-hero">
        <div className="eyebrow">Sitemap</div>
        <h1>Everything on <span className="smap-title-accent">Petal &amp; Rose, organized</span></h1>
        <p className="legal-lede">Browse every page across the Petal &amp; Rose website: the shop, brands, journal, and the support pages you may need, all in one clear map.</p>
      </div>

      <div className="smap-groups">
        <FlatGroup
          title="Main Pages"
          description="The core pages that make up the Petal &amp; Rose website."
          links={MAIN_LINKS}
        />

        <FlatGroup
          title="Shop by Category"
          description={catLinks.length ? 'Browse the shop filtered by the skincare category you care about.' : 'Browse the full beauty collection in the shop.'}
          links={[
            { label: `${cats.length ? 'See All ' : 'All'} Categories`, href: '/shop' },
            ...catLinks
          ]}
        />

        <LetterGroup
          title="Shop by Brand"
          description="Every authentic brand we stock, sorted A–Z."
          links={brandLinks}
        />

        <LetterGroup
          title="Journal"
          description="Skincare guides, routines, and ingredient deep-dives from our blog."
          links={journalLinks}
        />

        <FlatGroup
          title="Support & Policies"
          description="Everything you need to know about ordering, delivery, returns, and how we handle your data."
          links={[...SUPPORT_LINKS, { label: 'FAQs', href: '/faqs' }, { label: 'Track Your Order', href: '/track' }]}
        />
      </div>

      <div className="smap-cta">
        <div className="smap-cta-glow" aria-hidden="true" />
        <h2>Can&rsquo;t find what you&rsquo;re looking for?</h2>
        <p>If a page you expected isn&rsquo;t listed here, get in touch and we&rsquo;ll point you in the right direction.</p>
        <Link to="/contact" className="btn btn-primary smap-cta-btn">Contact Petal &amp; Rose</Link>
      </div>
    </div>
  );
}