import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api';
import { useApp } from '../../store';
import ProductCard from '../../components/store/ProductCard';
import Stars from '../../components/store/Stars';
import VerifiedBadge from '../../components/VerifiedBadge';
import { taka, truncate } from '../../utils';

export default function ProductDetail() {
  const { slug } = useParams();
  const { addToCart, notify, wish, toggleWish } = useApp();
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [img, setImg] = useState('');
  const [variant, setVariant] = useState('');
  const [qty, setQty] = useState(1);
  const [form, setForm] = useState({ rating: 5, name: '', title: '', text: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setP(null);
    setErr('');
    api.get(`/api/products/${slug}`)
      .then((r) => {
        setP(r.data);
        setImg(r.data.thumbnail || (r.data.images || [])[0] || '');
        setVariant(r.data.variants?.[0]?.size || r.data.size || '');
      })
      .catch((e) => setErr(e.message));
  }, [slug]);

  if (err) return <div className="container"><div className="page-head"><h1>Not found</h1><p className="muted">{err}</p><Link className="btn btn-outline mt-1" to="/shop">Back to Shop</Link></div></div>;
  if (!p) return <div className="loading"><span className="spinner" /></div>;

  const price = Number(p.salePrice || p.price || 0);
  const old = Number(p.originalPrice || p.price || 0);
  const images = (p.images && p.images.length ? p.images : [p.thumbnail]).filter(Boolean);
  const wished = wish.some((w) => w.id === p.id);
  const inStock = p.stock > 0;

  const submitReview = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.text.trim().length < 4) return notify('Please add your name and a short review.', 'info');
    setBusy(true);
    try {
      await api.post('/api/reviews', { productId: p.id, rating: form.rating, name: form.name, title: form.title, text: form.text });
      setForm({ rating: 5, name: '', title: '', text: '' });
      notify('Thank you! Your review is awaiting moderation.');
    } catch (er) { notify(er.message, 'info'); }
    finally { setBusy(false); }
  };

  return (
    <div className="container">
      <div className="page-head">
        <div className="breadcrumb"><Link to="/shop">Shop</Link> / {p.brand?.name || 'Products'}</div>
      </div>
      <div className="pd-grid">
        <div>
          <div className="gallery-main">
            <img src={img || '/placeholder.png'} alt={p.name} onError={(e) => { e.target.src = '/placeholder.png'; }} />
            {!inStock && <span className="pill out" style={{ position: 'absolute', top: 14, left: 14 }}>Sold Out</span>}
          </div>
          {images.length > 1 && (
            <div className="gallery-thumbs">
              {images.map((im, i) => (
                <img key={i} src={im} alt="" className={im === img ? 'active' : ''} onClick={() => setImg(im)} onError={(e) => { e.target.style.visibility = 'hidden'; }} />
              ))}
            </div>
          )}
        </div>

        <div className="pd-info">
          {p.brand?.name && <span className="pd-brand">{p.brand.name}</span>}
          <h1>{p.name}</h1>
          <Stars value={p.rating} size={15} /> <span className="muted small"> {p.rating} · {p.reviewCount} reviews</span>
          <div className="pd-price">
            <span>{taka(price)}</span>
            {old > price && <span className="old-price">{taka(old)}</span>}
            {p.discount > 0 && <span className="save">SAVE {p.discount}%</span>}
          </div>
          <p className="pd-desc">{p.shortDescription || p.description || truncate(p.description, 200)}</p>

          {p.variants?.length > 0 && (
            <div>
              <div className="small" style={{ fontWeight: 600 }}>Size: {variant}</div>
              <div className="variant-row">
                {p.variants.map((v) => (
                  <button key={v.id} className={`variant-chip ${variant === v.size ? 'active' : ''}`} onClick={() => setVariant(v.size)}>
                    {v.size || v.sku}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="qty-row">
            <div className="qty">
              <button onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
              <span>{qty}</span>
              <button onClick={() => setQty(Math.min(99, qty + 1))}>+</button>
            </div>
            <span className={`small mt-1`} style={{ color: inStock ? 'var(--green)' : 'var(--red)' }}>{inStock ? `In stock — ${p.stock} available` : 'Out of stock'}</span>
          </div>

          <div className="buy-row">
            <button className="btn btn-rose btn-lg" disabled={!inStock} onClick={() => addToCart({ ...p, size: variant }, qty, variant)}>
              <i className="fa-solid fa-bag-shopping" style={{ marginRight: 6 }} />Add to Bag · {taka(price * qty)}
            </button>
            <button className={`btn btn-outline btn-lg ${wished ? 'active' : ''}`} style={wished ? { borderColor: 'var(--rose)', color: 'var(--rose)' } : {}} onClick={() => toggleWish(p)}>
              {wished ? <><i className="fa-solid fa-heart" /> Saved</> : <><i className="fa-regular fa-heart" /> Save</>}
            </button>
          </div>

          <div style={{ marginTop: 30 }}>
            <details className="accordion" open>
              <summary>Description</summary>
              <div className="acc-body"><p>{p.description || 'Wrap your skin in this carefully chosen formula — part of a routine curated to bring out your natural glow.'}</p></div>
            </details>
            {p.ingredients?.length > 0 && (
              <details className="accordion">
                <summary>Key Ingredients</summary>
                <div className="acc-body"><p>{p.ingredients.join(', ')}</p></div>
              </details>
            )}
            {p.benefits?.length > 0 && (
              <details className="accordion">
                <summary>Benefits</summary>
                <div className="acc-body"><ul className="benefit-list">{p.benefits.map((b, i) => <li key={i}>{b}</li>)}</ul></div>
              </details>
            )}
            {p.howToUse && (
              <details className="accordion">
                <summary>How to Use</summary>
                <div className="acc-body"><p>{p.howToUse}</p></div>
              </details>
            )}
            {p.skinTypes?.length > 0 && (
              <details className="accordion">
                <summary>Skin Type</summary>
                <div className="acc-body"><p>{p.skinTypes.join(', ')}</p></div>
              </details>
            )}
          </div>

          {p.reviews && p.reviews.length > 0 && (
            <section className="section" style={{ paddingTop: 0 }}>
              <div className="section-head"><div className="eyebrow">What customers say</div><h2>Reviews & Ratings</h2></div>
              <div className="review-summary">
                <div className="center">
                  <div style={{ fontSize: 44, fontFamily: 'var(--serif)' }}>{p.rating}</div>
                  <Stars value={p.rating} size={16} />
                  <div className="muted small mt-1">{p.reviewCount} reviews</div>
                </div>
                <div>
                  {(p.ratingDistribution || []).slice().reverse().map((d) => (
                    <div className="review-bar" key={d.star}>
                      <span>{d.star} <i className="fa-solid fa-star" style={{ fontSize: 11 }} /></span>
                      <div className="fill"><i style={{ width: `${d.percent}%` }} /></div>
                      <span>{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                {p.reviews.map((r) => (
                  <div className="review" key={r.id}>
                    <Stars value={r.rating} size={13} />
                    <div className="who mt-1">{r.customer_name} {r.verified ? <VerifiedBadge /> : null}</div>
                    <p className="muted">{r.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="section" style={{ paddingTop: 0 }}>
            <div className="checkout-card" style={{ maxWidth: 700, margin: '0 auto' }}>
              <h3>Write a review</h3>
              <form onSubmit={submitReview}>
                <div className="field">
                  <label>Your rating</label>
                  <div style={{ display: 'flex', gap: 6, fontSize: 24 }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button type="button" key={s} onClick={() => setForm({ ...form, rating: s })} style={{ background: 'none', border: 0, fontSize: 26, color: form.rating >= s ? '#ffb904' : 'var(--line)' }}><i className="fa-solid fa-star" /></button>
                    ))}
                  </div>
                </div>
                <div className="form-grid">
                  <div className="field"><label>Name *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                </div>
                <div className="field"><label>Review *</label><textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Share what you liked about this product…" /></div>
                <button className="btn btn-rose" disabled={busy}>{busy ? 'Submitting…' : 'Submit Review'}</button>
              </form>
            </div>
          </section>

          {p.faq?.length > 0 && (
            <section className="section" style={{ paddingTop: 0 }}>
              <div className="section-head"><h2>Product FAQs</h2></div>
              <div className="faq-list">
                {p.faq.map((f, i) => (
                  <details className="faq-item" key={i}>
                    <summary>{f.q}</summary>
                    <div className="ans">{f.a}</div>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {p.related?.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="section-head"><div className="eyebrow">Pairs well with</div><h2>You may also like</h2></div>
          <div className="product-grid">{p.related.map((rp) => <ProductCard key={rp.id} p={rp} />)}</div>
        </section>
      )}
    </div>
  );
}