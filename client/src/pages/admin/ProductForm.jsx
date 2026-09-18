import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../api';
import { useApp } from '../../store';

const EMPTY = {
  sku: '', title: '', brand_id: '', category_id: '', mainCategory: 'Skincare', productType: '', size: '',
  description: '', shortDescription: '', price: '', salePrice: '', discount: 0, stock: 0,
  status: 'published', featured: false, bestSeller: false, newArrival: false, trending: false, onSale: true,
  rating: 4.5, tags: [], ingredients: [], benefits: [], howToUse: '', skinTypes: [], concerns: [],
  images: [], thumbnail: '', seoTitle: '', seoDescription: '',
  variants: []
};

export default function ProductForm() {
  const { id } = useParams();
  const edit = !!id;
  const navigate = useNavigate();
  const { notify } = useApp();
  const [f, setF] = useState({ ...EMPTY, variants: [] });
  const [cats, setCats] = useState([]);
  const [brands, setBrands] = useState([]);
  const [busy, setBusy] = useState(false);
  const [imgText, setImgText] = useState('');
  const [listText, setListText] = useState('');
  const [listField, setListField] = useState([]);

  useEffect(() => {
    api.get('/api/admin/categories').then((r) => setCats(r.data || [])).catch(() => {});
    api.get('/api/admin/brands').then((r) => setBrands(r.data || [])).catch(() => {});
    if (edit) {
      api.get(`/api/admin/products/${id}`).then((r) => {
        const p = r.data;
        setF({
          ...EMPTY, ...p,
          price: p.price || '', salePrice: p.salePrice || '', discount: p.discount || 0, stock: p.stock,
          brand_id: p.brand?.id || '', category_id: p.category?.id || '',
          tags: p.tags || [], ingredients: p.ingredients || [], benefits: p.benefits || [],
          skinTypes: p.skinTypes || [], concerns: p.concerns || [], images: p.images || [],
          variants: p.variants || []
        });
        setImgText((p.images || []).join('\n'));
      }).catch((e) => notify(e.message, 'info'));
    }
  }, [id]);

  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));

  const parseList = (text) => text.split('\n').map((s) => s.trim()).filter(Boolean);

  const changeList = (text) => {
    setListText(text);
    setListField(parseList(text));
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const payload = { ...f, images: parseList(imgText), tags: f.tags };
    try {
      if (edit) {
        await api.put(`/api/admin/products/${id}`, payload);
        notify('Product updated');
      } else {
        const r = await api.post('/api/admin/products', payload);
        navigate(`/admin/products/${r.data.id}`);
        notify('Product created');
      }
    } catch (ex) {
      notify(ex.message, 'info');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="admin-top">
        <div>
          <h1>{edit ? 'Edit product' : 'New product'}</h1>
          <p className="muted"><Link to="/admin/products"><i className="fa-solid fa-arrow-left" style={{ fontSize: 11, marginRight: 4 }} />Back to products</Link></p>
        </div>
        <button className="btn btn-rose" form="pf" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save Product'}</button>
      </div>

      <form id="pf" onSubmit={save}>
        <div className="admin-card">
          <h3>Basics</h3>
          <div className="form-grid">
            <div className="field"><label>Product title *</label><input className="input" required value={f.title} onChange={(e) => set('title', e.target.value)} /></div>
            <div className="field"><label>SKU</label><input className="input" value={f.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Auto-generated if empty" /></div>
            <div className="field"><label>Category</label>
              <select className="select" style={{ width: '100%' }} value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
                <option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Brand</label>
              <select className="select" style={{ width: '100%' }} value={f.brand_id} onChange={(e) => set('brand_id', e.target.value)}>
                <option value="">—</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Product type</label><input className="input" value={f.productType} onChange={(e) => set('productType', e.target.value)} placeholder="e.g. Serum, Toner" /></div>
            <div className="field"><label>Size / volume</label><input className="input" value={f.size} onChange={(e) => set('size', e.target.value)} placeholder="e.g. 30ml" /></div>
          </div>
        </div>

        <div className="admin-card">
          <h3>Pricing & stock</h3>
          <div className="form-grid">
            <div className="field"><label>Regular price (BDT) *</label><input className="input" required type="number" min="0" value={f.price} onChange={(e) => set('price', Number(e.target.value))} /></div>
            <div className="field"><label>Sale price (BDT)</label><input className="input" type="number" min="0" value={f.salePrice || ''} onChange={(e) => set('salePrice', Number(e.target.value) || 0)} placeholder="Defaults to regular price" /></div>
            <div className="field"><label>Stock</label><input className="input" type="number" min="0" value={f.stock} onChange={(e) => set('stock', Number(e.target.value))} /></div>
            <div className="field"><label>Status</label>
              <select className="select" style={{ width: '100%' }} value={f.status} onChange={(e) => set('status', e.target.value)}>
                <option value="published">Published</option><option value="draft">Draft</option><option value="hidden">Hidden</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[['featured', 'Featured'], ['bestSeller', 'Best seller'], ['newArrival', 'New arrival'], ['trending', 'Trending'], ['onSale', 'On sale']].map(([k, l]) => (
              <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <input type="checkbox" checked={!!f[k]} onChange={(e) => set(k, e.target.checked)} /> {l}
              </label>
            ))}
          </div>
        </div>

        <div className="admin-card">
          <h3>Content</h3>
          <div className="field"><label>Short description</label><textarea value={f.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} /></div>
          <div className="field"><label>Full description</label><textarea value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="field"><label>How to use</label><textarea value={f.howToUse} onChange={(e) => set('howToUse', e.target.value)} /></div>
          <div className="form-grid">
            <div className="field"><label>Rating (0–5)</label><input className="input" type="number" min="0" max="5" step="0.1" value={f.rating} onChange={(e) => set('rating', Number(e.target.value))} /></div>
            <div className="field"><label>SEO title</label><input className="input" value={f.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} /></div>
          </div>
          <div className="field"><label>SEO description</label><textarea value={f.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} /></div>
        </div>

        <div className="admin-card">
          <h3>Images</h3>
          <div className="field"><label>Image URLs (one per line)</label><textarea value={imgText} onChange={(e) => setImgText(e.target.value)} placeholder="https://…" /></div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {parseList(imgText).slice(0, 6).map((u, i) => (
              <img key={i} src={u} alt="" style={{ width: 70, height: 80, borderRadius: 8, objectFit: 'cover', border: i === 0 ? '2px solid var(--rose)' : '1px solid var(--line)' }} onError={(e) => { e.target.style.opacity = '.2'; }} />
            ))}
          </div>
          <p className="small muted mt-1">Upload images in Media &gt; Upload & paste their URLs here. First image is the thumbnail.</p>
        </div>

        <div className="admin-card">
          <h3>Tags, ingredients & benefits</h3>
          <div className="field"><label>Tags (comma separated)</label><input className="input" value={f.tags.join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} placeholder="brightening, glow, serum" /></div>
          <div className="form-grid">
            <div className="field"><label>Ingredients (one per line)</label><textarea value={(f.ingredients || []).join('\n')} onChange={(e) => set('ingredients', parseList(e.target.value))} /></div>
            <div className="field"><label>Benefits (one per line)</label><textarea value={(f.benefits || []).join('\n')} onChange={(e) => set('benefits', parseList(e.target.value))} /></div>
          </div>
          <div className="form-grid">
            <div className="field"><label>Skin types (comma sep)</label><input className="input" value={(f.skinTypes || []).join(', ')} onChange={(e) => set('skinTypes', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} /></div>
            <div className="field"><label>Concerns (comma sep)</label><input className="input" value={(f.concerns || []).join(', ')} onChange={(e) => set('concerns', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} /></div>
          </div>
        </div>

        <div className="admin-card">
          <h3>Variants (sizes)</h3>
          {f.variants.map((v, i) => (
            <div key={i} className="form-grid" style={{ marginBottom: 10 }}>
              <div className="field"><label>Size</label><input className="input" value={v.size} onChange={(e) => set('variants', f.variants.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))} /></div>
              <div className="field"><label>Price</label><input className="input" type="number" value={v.price} onChange={(e) => set('variants', f.variants.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))} /></div>
              <div className="field"><label>Old price</label><input className="input" type="number" value={v.oldPrice} onChange={(e) => set('variants', f.variants.map((x, j) => (j === i ? { ...x, oldPrice: Number(e.target.value) } : x)))} /></div>
              <div className="field"><label>Stock</label><input className="input" type="number" value={v.stock} onChange={(e) => set('variants', f.variants.map((x, j) => (j === i ? { ...x, stock: Number(e.target.value) } : x)))} /></div>
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => set('variants', [...f.variants, { size: '', price: f.salePrice || f.price || 0, oldPrice: f.price || 0, stock: f.stock || 0 }])}>+ Add size variant</button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 40 }}>
          <button className="btn btn-rose" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save Product'}</button>
          <Link className="btn btn-outline" to="/admin/products">Cancel</Link>
        </div>
      </form>
    </div>
  );
}