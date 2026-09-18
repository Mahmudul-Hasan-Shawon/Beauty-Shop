import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useApp } from '../../store';

const EMPTY = { title: '', eyebrow: '', description: '', buttonText: 'Shop Now', link: '/shop', image: '', enabled: true };

export default function Banners() {
  const { notify } = useApp();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = () => api.get('/api/admin/banners').then((r) => setRows(r.data || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const reset = () => { setEditing(null); setForm(EMPTY); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/api/admin/banners/${editing}`, form); notify('Banner updated'); }
      else { await api.post('/api/admin/banners', form); notify('Banner created'); }
      reset(); load();
    } catch (ex) { notify(ex.message, 'info'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this banner?')) return;
    try { await api.del(`/api/admin/banners/${id}`); load(); } catch (e) { notify(e.message, 'info'); }
  };

  return (
    <div>
      <div className="admin-top"><div><h1>Banners</h1><p className="muted">{rows.length} banners</p></div></div>
      <div className="admin-card">
        <h3>{editing ? 'Edit banner' : 'New banner'}</h3>
        <form onSubmit={save} className="form-grid">
          <div className="field"><label>Title *</label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="field"><label>Eyebrow text</label><input className="input" value={form.eyebrow} onChange={(e) => setForm({ ...form, eyebrow: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: '1/-1' }}><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="field"><label>Button text</label><input className="input" value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} /></div>
          <div className="field"><label>Link</label><input className="input" placeholder="/product/slug · /shop · /routine" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: '1/-1' }}><label>Image URL</label><input className="input" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <label style={{ fontSize: 14 }}><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled</label>
            <button className="btn btn-rose btn-sm" type="submit">{editing ? 'Save' : 'Create'}</button>
            {editing && <button className="btn btn-ghost btn-sm" type="button" onClick={reset}>Cancel</button>}
          </div>
        </form>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {rows.map((b) => (
          <div key={b.id} className="admin-card" style={{ marginBottom: 0, display: 'flex', gap: 12 }}>
            {b.image && <img src={b.image} alt="" style={{ width: 110, height: 130, borderRadius: 10, objectFit: 'cover' }} onError={(e) => { e.target.style.visibility = 'hidden'; }} />}
            <div style={{ flex: 1 }}>
              <b>{b.title}</b>
              <p className="small muted" style={{ margin: '4px 0' }}>{b.eyebrow}</p>
              <div className="small"><i className="fa-solid fa-arrow-right" style={{ fontSize: 10, marginRight: 4 }} />{b.link} · {b.enabled ? 'active' : 'disabled'}</div>
              <div className="mt-1" style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-outline btn-sm" onClick={() => { setEditing(b.id); setForm({ title: b.title, eyebrow: b.eyebrow, description: b.description, buttonText: b.button_text, link: b.link, image: b.image, enabled: !!b.enabled }); }}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => del(b.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}