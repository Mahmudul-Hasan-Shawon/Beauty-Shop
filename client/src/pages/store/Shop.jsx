import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api';
import ProductCard from '../../components/store/ProductCard';
import { useApp } from '../../store';

const SORTS = [
  ['featured', 'Featured'],
  ['best-seller', 'Best Sellers'],
  ['newest', 'Newest'],
  ['popular', 'Most Popular'],
  ['price-asc', 'Price: Low to High'],
  ['price-desc', 'Price: High to Low'],
  ['rating-desc', 'Top Rated'],
  ['discount', 'Biggest Discount']
];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const { wish } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState([]);
  const [brands, setBrands] = useState([]);
  const [mobileFilters, setMobileFilters] = useState(false);

  const showWish = params.get('wishlist') === '1';
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const brand = params.get('brand') || '';
  const sort = params.get('sort') || 'featured';
  const page = Number(params.get('page')) || 1;
  const minPrice = params.get('minPrice') || '';
  const maxPrice = params.get('maxPrice') || '';

  useEffect(() => {
    if (showWish) return;
    setLoading(true);
    const query = { q, category, brand, sort, page, perPage: 12 };
    if (minPrice) query.minPrice = minPrice;
    if (maxPrice) query.maxPrice = maxPrice;
    api.get('/api/products', query)
      .then((r) => setData({ products: r.data, meta: r.meta }))
      .catch(() => setData({ products: [], meta: null }))
      .finally(() => setLoading(false));
  }, [q, category, brand, sort, page, minPrice, maxPrice, showWish]);

  useEffect(() => {
    api.get('/api/categories').then((r) => setCats(r.data || [])).catch(() => {});
    api.get('/api/brands').then((r) => setBrands(r.data || [])).catch(() => {});
  }, []);

  const setParam = (key, val) => {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const wishProducts = useMemo(() => wish, [wish]);

  const products = showWish ? wishProducts.map((w) => ({
    id: w.id, name: w.name, slug: w.slug, thumbnail: w.thumbnail, salePrice: w.salePrice, price: w.price,
    originalPrice: w.price, discount: w.discount, inStock: w.inStock, stock: w.inStock ? 1 : 0, brand: { name: w.brand }, rating: 0
  })) : (data?.products || []);

  return (
    <div className="container">
      <div className="page-head">
        <div className="breadcrumb">Home / Shop</div>
        <h1>{showWish ? 'Your Wishlist' : category ? (cats.find((c) => c.slug === category)?.name || 'Shop') : 'Shop Collection'}</h1>
        <p>{showWish ? `${wish.length} saved items, ready when you are.` : 'Authentic skincare and beauty, curated for glowing skin.'}</p>
      </div>

      {!showWish && (
        <div className="center mt-2">
          <div className="search-input" style={{ maxWidth: 480, margin: '0 auto' }}>
            <input value={q} placeholder="Search products…" onChange={(e) => setParam('q', e.target.value)} />
          </div>
        </div>
      )}

      <div className="shop-layout">
        <aside className={`filters ${mobileFilters ? 'mobile-open' : ''}`}>
          <button className="btn btn-sm btn-outline" style={{ display: 'none' }}>filters</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>Filters</h4>
            <button className="chip" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Clear</button>
          </div>

          <h4 className="filters-title">Category</h4>
          {cats.map((c) => (
            <label key={c.id} className={`option ${category === c.slug ? 'active' : ''}`} onClick={() => setParam('category', c.slug === category ? '' : c.slug)}>
              {c.name} <span className="count">{c.productCount}</span>
            </label>
          ))}

          <h4 className="filters-title">Brand</h4>
          <div style={{ maxHeight: 210, overflowY: 'auto', paddingRight: 8 }} data-lenis-prevent>
            {brands.map((b) => (
              <label key={b.id} className={`option ${brand === b.slug ? 'active' : ''}`} onClick={() => setParam('brand', b.slug === brand ? '' : b.slug)}>
                {b.name} <span className="count">{b.productCount}</span>
              </label>
            ))}
          </div>

          <h4 className="filters-title">Price (BDT)</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" type="number" placeholder="Min" value={minPrice} onChange={(e) => setParam('minPrice', e.target.value)} />
            <input className="input" type="number" placeholder="Max" value={maxPrice} onChange={(e) => setParam('maxPrice', e.target.value)} />
          </div>

          <h4 className="filters-title">Sort</h4>
          <select className="select" style={{ width: '100%' }} value={sort} onChange={(e) => setParam('sort', e.target.value)}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </aside>

        <div>
          {!showWish && (
            <div className="toolbar">
              <button className="btn btn-sm btn-outline" style={{ display: 'none' }} onClick={() => setMobileFilters(!mobileFilters)}>Filters</button>
              <span className="result">{loading ? 'Loading…' : `${data?.meta?.total || 0} products`}</span>
              <select className="select" value={sort} onChange={(e) => setParam('sort', e.target.value)}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          )}

          {loading && !showWish && <div className="loading"><span className="spinner" /></div>}

          {!loading && products.length === 0 && (
            <div className="admin-card center">
              <h3>{showWish ? 'No saved items yet' : 'No products found'}</h3>
              <p className="muted">{showWish ? 'Tap the heart on any product to save it here.' : 'Try adjusting your filters or search terms.'}</p>
              <button className="btn btn-rose mt-1" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Clear Filters</button>
            </div>
          )}

          {products.length > 0 && (
            <div className="product-grid">
              {products.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}

          {!showWish && data?.meta?.pages > 1 && (
            <div className="paging">
              {Array.from({ length: Math.min(data.meta.pages, 10) }, (_, i) => i + 1).map((pp) => (
                <button key={pp} className={pp === page ? 'active' : ''} onClick={() => setParam('page', pp)}>{pp}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}