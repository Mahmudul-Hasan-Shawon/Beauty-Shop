import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useApp } from '../../store';

export default function Categories() {
  const { notify } = useApp();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', image: '', featured: true, enabled: true });

  const load = () => api.get('/api/admin/categories').then((r) => setRows(r.data || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const reset = () => { setEditing(null); setForm({ name: '', description: '', image: '', featured: true, enabled: true }); };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return notify('Name is required.', 'info');
    try {
      if (editing) { await api.put(`/api/admin/categories/${editing}`, form); notify('Category updated'); }
      else { await api.post('/api/admin/categories', form); notify('Category created'); }
      reset(); load();
    } catch (ex) { notify(ex.message, 'info'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try { await api.del(`/api/admin/categories/${id}`); load(); notify('Deleted'); } catch (e) { notify(e.message, 'info'); }
  };

  return (
    <div>
      <div className="admin-top"><div><h1>Categories</h1><p className="muted">{rows.length} categories</p></div></div>
      <div className="admin-card">
        <h3>{editing ? 'Edit category' : 'New category'}</h3>
        <form onSubmit={save} className="form-grid">
          <div className="field"><label>Name *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Image URL</label><input className="input" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: '1 / -1' }}><label>Description</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <label style={{ fontSize: 14 }}><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
            <label style={{ fontSize: 14 }}><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled</label>
            <button className="btn btn-rose btn-sm" type="submit">{editing ? 'Save' : 'Create'}</button>
            {editing && <button className="btn btn-ghost btn-sm" type="button" onClick={reset}>Cancel</button>}
          </div>
        </form>
      </div>
      <div className="admin-card" style={{ padding: 0, overflowX: 'auto' }}>
        <div className="table-scroll">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Products</th><th>Featured</th><th>Enabled</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><b>{c.name}</b><div className="small muted">/shop?category={c.slug}</div></td>
                <td>{c.productCount || 0}</td>
                <td>{c.featured ? <i className="fa-solid fa-circle-check" style={{ color: 'var(--green)' }} /> : '—'}</td>
                <td>{c.enabled ? <i className="fa-solid fa-circle-check" style={{ color: 'var(--green)' }} /> : '—'}</td>
                <td>
                  <button className="btn btn-outline btn-sm" onClick={() => { setEditing(c.id); setForm({ name: c.name, description: c.description, image: c.image, featured: !!c.featured, enabled: !!c.enabled }); }}>Edit</button>
                  <button className="btn btn-danger btn-sm" style={{ marginLeft: 6 }} onClick={() => del(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}