import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useApp } from '../../store';

export default function FaqsAdmin() {
  const { notify } = useApp();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ question: '', answer: '', section: 'general', enabled: true });

  const load = () => api.get('/api/admin/faqs').then((r) => setRows(r.data || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const reset = () => { setEditing(null); setForm({ question: '', answer: '', section: 'general', enabled: true }); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/api/admin/faqs/${editing}`, form); notify('FAQ updated'); }
      else { await api.post('/api/admin/faqs', form); notify('FAQ created'); }
      reset(); load();
    } catch (ex) { notify(ex.message, 'info'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this FAQ?')) return;
    try { await api.del(`/api/admin/faqs/${id}`); load(); } catch (e) { notify(e.message, 'info'); }
  };

  return (
    <div>
      <div className="admin-top"><div><h1>FAQs</h1><p className="muted">{rows.length} questions</p></div></div>
      <div className="admin-card">
        <h3>{editing ? 'Edit FAQ' : 'New FAQ'}</h3>
        <form onSubmit={save}>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: '1/-1' }}><label>Question *</label><input className="input" required value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: '1/-1' }}><label>Answer *</label><textarea required value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} /></div>
            <div className="field"><label>Section</label>
              <select className="select" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>
                {['general', 'shipping', 'payment', 'orders', 'returns'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <label style={{ fontSize: 14 }}><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled</label>
              <button className="btn btn-rose btn-sm" type="submit">{editing ? 'Save' : 'Create'}</button>
              {editing && <button className="btn btn-ghost btn-sm" type="button" onClick={reset}>Cancel</button>}
            </div>
          </div>
        </form>
      </div>
      <div className="admin-card" style={{ padding: 0 }}>
        {rows.map((f) => (
          <div key={f.id} style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div><b>{f.question}</b> <span className="tag">{f.section}</span> {f.enabled ? '' : <span className="tag">disabled</span>}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-outline btn-sm" onClick={() => { setEditing(f.id); setForm({ question: f.question, answer: f.answer, section: f.section || 'general', enabled: !!f.enabled }); }}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => del(f.id)}>Delete</button>
              </div>
            </div>
            <p className="muted small" style={{ marginBottom: 0, marginTop: 4 }}>{f.answer}</p>
          </div>
        ))}
        {!rows.length && <p className="center muted" style={{ padding: 30 }}>No FAQs yet.</p>}
      </div>
    </div>
  );
}