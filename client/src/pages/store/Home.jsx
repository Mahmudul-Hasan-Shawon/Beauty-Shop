import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useApp } from '../../store';
import ProductCard from '../../components/store/ProductCard';
import Stars from '../../components/store/Stars';
import Newsletter from './Newsletter';
import heroImg from '../../images/hero/hero.jpg';
import catSkincare from '../../images/shop-by-category/skincare.jpg';
import catMakeup from '../../images/shop-by-category/makeup.jpg';
import catHaircare from '../../images/shop-by-category/haircare.jpg';
import catBodycare from '../../images/shop-by-category/bodycare.jpg';
import catFragrance from '../../images/shop-by-category/fragrance.jpg';
import catLipcare from '../../images/shop-by-category/lipcare.jpg';
import catSuncare from '../../images/shop-by-category/suncare.jpg';
import catBeautytools from '../../images/shop-by-category/beautytools.jpg';
import { journalCover } from '../../images/journal';
import { brandRows } from '../../lib/brandLogos';

const CAT_IMG = {
  skincare: catSkincare,
  makeup: catMakeup,
  'hair-care': catHaircare,
  'body-care': catBodycare,
  fragrance: catFragrance,
  'lip-care': catLipcare,
  'sun-care': catSuncare,
  'beauty-tools': catBeautytools
};

export default function Home() {
  const { settings } = useApp();
  const [featured, setFeatured] = useState([]);
  const [bestsellers, setBestsellers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [journal, setJournal] = useState([]);
  const [heroAnim, setHeroAnim] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [brandChips, setBrandChips] = useState([]);

  const hero = settings.hero || {};
  const slides = settings.banners || [];

  useEffect(() => {
    const t = requestAnimationFrame(() => setHeroAnim(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setBannerIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  useEffect(() => {
    api.get('/api/products', { perPage: 8, featured: '1' }).then((r) => setFeatured(r.data || [])).catch(() => {});
    api.get('/api/products', { perPage: 8, sort: 'best-seller' }).then((r) => setBestsellers(r.data || [])).catch(() => {});
    api.get('/api/categories').then((r) => setCategories((r.data || []).filter((c) => c.image))).catch(() => {});
    api.get('/api/brands').then((r) => { const bs = r.data || []; setBrands(bs); setBrandChips(brandRows(bs)); }).catch(() => {});
    api.get('/api/journal').then((r) => setJournal((r.data || []).slice(0, 3))).catch(() => {});
  }, []);

  return (
    <>
      <section className="hero">
        <img src={heroImg} alt="" className="hero-bg" aria-hidden="true" />
        <div className="hero-overlay" />
        <div className={`container hero-content${heroAnim ? ' rise' : ''}`}>
          <div className="eyebrow">{hero.eyebrow || 'Petal & Rose · Beauty Room'}</div>
          <h1>{hero.heading || <>Glow begins with the <em>right ritual.</em></>}</h1>
          <p className="lead">{hero.description || 'Hand-picked Korean and global skincare essentials — curated for your skin, delivered to your door.'}</p>
          <div className="hero-cta">
            <Link className="btn btn-rose btn-lg" to={hero.primaryLink || '/shop'}>{hero.primaryCta || 'Shop the Edit'}</Link>
            <Link className="btn btn-outline btn-lg" to={hero.secondaryLink || '/routine'}>{hero.secondaryCta || 'Find Your Routine'}</Link>
          </div>
          <div className="hero-proof">
            <Stars value={5} size={14} />
            <span><b>4.9/5</b> — loved by thousands of skincare lovers across Bangladesh</span>
          </div>
          <div className="hero-chips">
            <span><span className="cert-ico" aria-hidden="true" /> 100% Authentic</span>
            <span><i className="fa-solid fa-house" /> Inside Dhaka in 1-2 Days</span>
            <span><i className="fa-solid fa-hand-holding-dollar" /> Cash on Delivery</span>
          </div>
        </div>
      </section>

      <div className="marquee">
        <div className="marquee-track">
          {[...Array(2)].flatMap((_, k) => [
            '100% Authentic Products', 'Inside Dhaka in 1-2 Days',
            'Cash on Delivery', 'bKash & Nagad Accepted', 'Genuine Korean & Global Brands'
          ]).map((t, i) => <span key={i}><i className="fa-solid fa-star" style={{ fontSize: 9, opacity: 0.6 }} /> &nbsp;{t}&nbsp;&nbsp;</span>)}
        </div>
      </div>

      {slides.length > 0 && (
        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="container">
            <div className="banner-slider">
              <div className="banner-track" style={{ transform: `translateX(-${bannerIndex * 100}%)` }}>
                {slides.map((b) => (
                  <Link key={b.id} to={b.link || '/shop'} className="banner-slide">
                    {b.image && <img src={b.image} alt={b.title} />}
                    <div className="banner-shade" />
                    <div className="banner-copy">
                      {b.eyebrow && <div className="eyebrow">{b.eyebrow}</div>}
                      <h3 style={{ whiteSpace: 'pre-line' }}>{b.title}</h3>
                      {b.description && <p className="muted">{b.description}</p>}
                      <span className="btn btn-rose btn-sm mt-1">{b.button_text || 'Shop Now'}</span>
                    </div>
                  </Link>
                ))}
              </div>
              {slides.length > 1 && (
                <div className="banner-dots">
                  {slides.map((_, i) => (
                    <button key={i} className={`dot ${i === bannerIndex ? 'on' : ''}`} onClick={() => setBannerIndex(i)} aria-label={`slide ${i + 1}`} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {categories.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <div className="eyebrow">Shop by Category</div>
              <h2>Curated for every need</h2>
              <p>From everyday essentials to treat-yourself rituals.</p>
            </div>
            <div className="cat-grid">
              {categories.map((c) => (
                <Link key={c.id} to={`/shop?category=${c.slug}`} className="cat-card">
                  <div className="img"><img src={CAT_IMG[c.slug] || c.image} alt={c.name} loading="lazy" onError={(e) => { e.target.style.visibility = 'hidden'; }} /></div>
                  <div className="name">{c.name}</div>
                  <div className="count">{c.productCount} products</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {brandChips.length > 0 && (
        <section className="section" id="brands-marquee" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <div className="eyebrow">Genuine &amp; trusted</div>
              <h2>Brands we carry</h2>
            </div>
          </div>
          <div className="brand-marquee">
            <div className="brand-marquee-track">
              {[...brandChips, ...brandChips].map((b, i) => (
                <Link key={`${b.key}-${i}`} to={b.href} className="brand-chip" title={b.name} aria-label={b.name}>
                  <img src={b.url} alt={`${b.name} logo`} loading="lazy" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Loved by thousands</div>
            <h2>Best Sellers</h2>
          </div>
          <div className="product-grid">
            {bestsellers.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <div className="eyebrow">Hand-picked</div>
              <h2>Featured Collection</h2>
            </div>
            <div className="product-grid">
              {featured.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
            <div className="center mt-3">
              <Link to="/shop" className="btn btn-outline">View All Products</Link>
            </div>
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="promo-strip">
            <div className="promo-item"><span className="ico"><i className="fa-solid fa-truck" /></span><div><h4>Fast Delivery</h4><p>Inside Dhaka in 1–2 days, nationwide in 2–4 days.</p></div></div>
            <div className="promo-item"><span className="ico"><span className="cert-ico" aria-hidden="true" /></span><div><h4>100% Authentic</h4><p>Verified products from authorized distributors.</p></div></div>
            <div className="promo-item"><span className="ico"><span className="support-ico" aria-hidden="true" /></span><div><h4>Easy Support</h4><p>Message us on WhatsApp for any questions.</p></div></div>
          </div>
        </div>
      </section>

      {journal.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head">
              <div className="eyebrow">The Journal</div>
              <h2>Skincare wisdom</h2>
            </div>
            <div className="article-grid">
              {journal.map((a, i) => (
                <Link key={a.id} to={`/journal/${a.slug}`} className="article-card">
                  <div className="cover"><img src={journalCover(a, i)} alt={a.title} loading="lazy" /></div>
                  <div className="meta"><span>{a.category}</span><span>{a.author}</span></div>
                  <h3>{a.title}</h3>
                  <p className="excerpt">{a.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <Newsletter />
        </div>
      </section>
    </>
  );
}