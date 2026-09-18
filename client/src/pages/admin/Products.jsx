import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { useApp } from '../../store';
import { taka } from '../../utils';

export default function Products() {
  const { notify } = useApp();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [cats, setCats] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [bulkMenu, setBulkMenu] = useState('');

  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const status = params.get('status') || '';
  const page = Number(params.get('page')) || 1;

  const load = () => {
    setLoading(true);
    api.get('/api/admin/products', { q, category_id: category, status, page, perPage: 20 })
      .then((r) => { setRows(r.data || []); setMeta(r.meta || {}); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [q, category, status, page]);
  useEffect(() => {
    api.get('/api/admin/categories').then((r) => setCats(r.data || [])).catch(() => {});
    api.get('/api/admin/brands').then((r) => setBrands(r.data || [])).catch(() => {});
  }, []);

  const setParam = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== 'page') n.delete('page');
    setParams(n, { replace: true });
  };

  const toggleFlag = async (id, field, val) => {
    try {
      await api.patch(`/api/admin/products/${id}/flags`, { [field]: val });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
      notify('Updated');
    } catch (e) { notify(e.message, 'info'); }
  };

  const duplicate = async (id) => {
    try {
      const r = await api.post(`/api/admin/products/${id}/duplicate`);
      notify('Duplicated');
      window.location.href = `/admin/products/${r.data.id}`;
    } catch (e) { notify(e.message, 'info'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this product permanently?')) return;
    try { await api.del(`/api/admin/products/${id}`); notify('Deleted'); load(); } catch (e) { notify(e.message, 'info'); }
  };

  const bulk = async () => {
    if (!selected.length || !bulkMenu) return;
    try {
      await api.post('/api/admin/products/bulk', { ids: selected, action: bulkMenu, value: bulkMenu.startsWith('category') ? JSON.parse(prompt('Category ID:') || '0') : true });
      notify('Done');
      setSelected([]);
      load();
    } catch (e) { notify(e.message, 'info'); }
  };

  const toggleSel = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div>
      <div className="admin-top">
        <div><h1>Products</h1><p className="muted">{meta.total} total</p></div>
        <Link className="btn btn-rose" to="/admin/products/new">+ New Product</Link>
      </div>

      <div className="admin-card" style={{ padding: '16px 22px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Search name / SKU…" value={q} onChange={(e) => setParam('q', e.target.value)} />
          <select className="select" value={category} onChange={(e) => setParam('category', e.target.value)}>
            <option value="">All categories</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="select" value={status} onChange={(e) => setParam('status', e.target.value)}>
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="hidden">Hidden</option>
          </select>
          <select className="select" value={bulkMenu} onChange={(e) => setBulkMenu(e.target.value)}>
            <option value="">Bulk actions…</option>
            <option value="publish">Publish</option>
            <option value="unpublish">Unpublish</option>
            <option value="featured">Toggle featured</option>
          </select>
          <button className="btn btn-outline btn-sm" disabled={!selected.length || !bulkMenu} onClick={bulk}>Apply ({selected.length})</button>
        </div>
      </div>

      <div className="admin-card" style={{ padding: 0, overflowX: 'auto' }}>
        <div className="table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 34 }}><input type="checkbox" checked={selected.length === rows.length && rows.length > 0} onChange={() => setSelected(selected.length === rows.length ? [] : rows.map((r) => r.id))} /></th>
              <th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Flags</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="8" className="center"><span className="spinner" /></td></tr>}
            {!loading && rows.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSel(r.id)} /></td>
                <td>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <img src={r.thumbnail || '/placeholder.png'} alt="" style={{ width: 40, height: 44, borderRadius: 8, objectFit: 'cover' }} onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                    <div>
                      <Link to={`/admin/products/${r.id}`} style={{ color: 'var(--rose)' }}><b>{r.title}</b></Link>
                      <div className="small muted">SKU: {r.sku}</div>
                    </div>
                  </div>
                </td>
                <td>{r.category_name || '—'}</td>
                <td>{taka(r.sale_price || r.price)}{r.discount_pct > 0 && <span className="small" style={{ color: 'var(--rose)' }}> −{r.discount_pct}%</span>}</td>
                <td><input className="input" type="number" style={{ width: 70, padding: '6px 8px' }} value={r.stock} onChange={(e) => toggleFlag(r.id, 'stock', Number(e.target.value))} /></td>
                <td>
                  <select className="select" style={{ padding: '6px 8px' }} value={r.status} onChange={(e) => toggleFlag(r.id, 'status', e.target.value)}>
                    <option value="published">Published</option><option value="draft">Draft</option><option value="hidden">Hidden</option>
                  </select>
                </td>
                <td>
                  <button className={`chip ${r.featured ? '' : ''}`} style={r.featured ? { background: 'var(--rose)', color: '#fff' } : {}} onClick={() => toggleFlag(r.id, 'featured', r.featured ? 0 : 1)}>Featured</button>
                  <button className={`chip ${r.best_seller ? '' : ''}`} style={r.best_seller ? { background: 'var(--gold-dark)', color: '#fff' } : {}} onClick={() => toggleFlag(r.id, 'best_seller', r.best_seller ? 0 : 1)}>Best</button>
                  <button className={`chip ${r.new_arrival ? '' : ''}`} style={r.new_arrival ? { background: 'var(--green)', color: '#fff' } : {}} onClick={() => toggleFlag(r.id, 'new_arrival', r.new_arrival ? 0 : 1)}>New</button>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="icon-btn" title="Duplicate" onClick={() => duplicate(r.id)}><i className="fa-solid fa-clone" /></button>
                    <button className="icon-btn btn-danger" title="Delete" onClick={() => del(r.id)}><i className="fa-solid fa-trash-can" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !rows.length && <tr><td colSpan="8" className="center muted">No products match.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      {meta.pages > 1 && (
        <div className="paging">
          {Array.from({ length: meta.pages }, (_, i) => i + 1).slice(0, 10).map((p) => (
            <button key={p} className={p === page ? 'active' : ''} onClick={() => setParam('page', p)}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}