import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store';
import { taka } from '../../utils';
import Stars from './Stars';

export default function ProductCard({ p }) {
  const { addToCart, wish, toggleWish } = useApp();
  const price = Number(p.salePrice || p.price || 0);
  const old = Number(p.originalPrice || p.price || 0);
  const hasDiscount = Number(p.discount || 0) > 0 && old > price;
  const wished = wish.some((w) => w.id === p.id);
  const out = !p.inStock || Number(p.stock ?? 1) <= 0;
  const low = !out && Number(p.stock) <= 5;
  const stockCls = out ? 'out' : low ? 'low' : 'in';
  const stockLabel = out ? 'Out of Stock' : low ? 'Low Stock' : 'In Stock';
  const badges = [];
  if (p.newArrival) badges.push({ t: 'New', cls: 'new' });
  if (p.bestSeller) badges.push({ t: 'Best Seller', cls: 'best' });
  if (p.trending) badges.push({ t: 'Trending', cls: 'trend' });

  return (
    <div className="pcard">
      <div className="card-img">
        <Link to={`/product/${p.slug}`}>
          <img src={p.thumbnail || '/placeholder.png'} alt={p.name} loading="lazy" decoding="async" onError={(e) => { e.target.style.visibility = 'hidden'; }} />
        </Link>
        <div className="card-badges">
          {badges.map((b, i) => <span key={i} className={`pill ${b.cls}`}>{b.t}</span>)}
          {hasDiscount ? <span className="badge badge-sale">-{p.discount}%</span> : null}
          {!hasDiscount && out ? <span className="badge badge-oos">Out of Stock</span> : null}
          {!hasDiscount && !out && low ? <span className="badge badge-low">Low Stock</span> : null}
        </div>
        <button className={`wish-btn ${wished ? 'active' : ''}`} onClick={() => toggleWish(p)} aria-label="wishlist">
          {wished ? <i className="fa-solid fa-heart" /> : <i className="fa-regular fa-heart" />}
        </button>
      </div>
      <div className="card-body">
        {p.brand?.name && <span className="card-brand">{p.brand.name}</span>}
        <Link to={`/product/${p.slug}`}>
          <div className="card-name">{p.name}</div>
        </Link>
        {p.size && <p className="card-size">{p.size}</p>}
        <div className="card-pricing">
          <span className="p-new">{taka(price)}</span>
          {hasDiscount && <span className="p-old">{taka(old)}</span>}
        </div>
        <div className="card-rating">
          <Stars value={p.rating} size={12} />
          <span className="muted small">{p.rating} · {p.reviewCount} reviews</span>
        </div>
        <div className="card-foot">
          <span className={`stock-tag ${stockCls}`}>{stockLabel}</span>
          <button className="add-btn" aria-label="Add to bag" type="button" disabled={out} onClick={() => addToCart(p, 1)}>
            <i className="fa-solid fa-cart-plus" />
          </button>
        </div>
      </div>
    </div>
  );
}