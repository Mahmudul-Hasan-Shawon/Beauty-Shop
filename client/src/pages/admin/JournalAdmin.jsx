import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useApp } from '../../store';
import { dates } from '../../utils';

export default function JournalAdmin() {
  const { notify } = useApp();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', category: '', author: 'Editorial Team', cover: '', excerpt: '', content: '', tags: '', published: true });
  const [products, setProducts] = useState([]);
  const [related, setRelated] = useState([]);

  const load = () => api.get('/api/admin/journal').then((r) => setRows(r.data || [])).catch(() => {});
  useEffect(() => { load(); api.get('/api/admin/products', { perPage: 12 }).then((r) => setProducts(r.data || [])).catch(() => {}); }, []);

  const reset = () => { setEditing(null); setRelated([]); setForm({ title: '', category: '', author: 'Editorial Team', cover: '', excerpt: '', content: '', tags: '', published: true }); };

  const save = async (e) => {
    e.preventDefault();
    const payload = { ...form, tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean), relatedProducts: related };
    try {
      if (editing) { await api.put(`/api/admin/journal/${editing}`, payload); notify('Article updated'); }
      else { await api.post('/api/admin/journal', payload); notify('Article created'); }
      reset(); load();
    } catch (ex) { notify(ex.message, 'info'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this article?')) return;
    try { await api.del(`/api/admin/journal/${id}`); load(); } catch (e) { notify(e.message, 'info'); }
  };

  return (
    <div>
      <div className="admin-top"><div><h1>Journal</h1><p className="muted">{rows.length} articles</p></div></div>
      <div className="admin-card">
        <h3>{editing ? 'Edit article' : 'New article'}</h3>
        <form onSubmit={save}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: '1/-1' }}><label>Title *</label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="field"><label>Category</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div className="field"><label>Author</label><input className="input" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: '1/-1' }}><label>Cover URL</label><input className="input" value={form.cover} onChange={(e) => setForm({ ...form, cover: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: '1/-1' }}><label>Excerpt</label><textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: '1/-1' }}><label>Content (paragraphs separated by blank line)</label><textarea style={{ minHeight: 180 }} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
          </div>
          <div className="field"><label>Tags (comma separated)</label><input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
          <div className="field">
            <label>Related products</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {products.map((p) => (
                <button key={p.id} type="button" className={`chip ${related.includes(p.id) ? '' : 'x'}`} style={related.includes(p.id) ? { background: 'var(--rose)', color: '#fff' } : {}} onClick={() => setRelated(related.includes(p.id) ? related.filter((x) => x !== p.id) : [...related, p.id])}>
                  {p.title}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <label style={{ fontSize: 14 }}><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Published</label>
            <button className="btn btn-rose btn-sm" type="submit">{editing ? 'Save' : 'Create'}</button>
            {editing && <button className="btn btn-ghost btn-sm" type="button" onClick={reset}>Cancel</button>}
          </div>
        </form>
      </div>
<div className="admin-card" style={{ padding: 0 }}>
        <div className="table-scroll">
        <table className="admin-table">
          <thead><tr><th>Title</th><th>Category</th><th>Date</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><EditChip onClick={() => { setEditing(a.id); setForm({ title: a.title, category: a.category, author: a.author, cover: a.cover, excerpt: a.excerpt, content: a.content, tags: (a.tags || []).join(', '), published: !!a.published }); setRelated(a.relatedProducts || []); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><b style={{ color: 'var(--rose)', cursor: 'pointer' }}>{a.title}</b></EditChip></td>
                <td>{a.category || '—'}</td>
                <td className="small">{dates(a.created_at)}</td>
                <td>{a.published ? <span className="status-pill st-delivered">published</span> : <span className="status-pill st-pending">draft</span>}</td>
                <td><button className="btn btn-danger btn-sm" onClick={() => del(a.id)}>Delete</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="5" className="center muted">No articles yet.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function EditChip({ children, onClick }) { return <span onClick={onClick}>{children}</span>; }
