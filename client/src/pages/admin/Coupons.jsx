import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useApp } from '../../store';

export default function Coupons() {
  const { notify } = useApp();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', type: 'percent', value: 10, minOrder: 0, maxDiscount: 0, usageLimit: 0, startDate: '', endDate: '', enabled: true });

  const load = () => api.get('/api/admin/coupons').then((r) => setRows(r.data || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const reset = () => { setEditing(null); setForm({ code: '', type: 'percent', value: 10, minOrder: 0, maxDiscount: 0, usageLimit: 0, startDate: '', endDate: '', enabled: true }); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/api/admin/coupons/${editing}`, form); notify('Coupon updated'); }
      else { await api.post('/api/admin/coupons', form); notify('Coupon created'); }
      reset(); load();
    } catch (ex) { notify(ex.message, 'info'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this coupon?')) return;
    try { await api.del(`/api/admin/coupons/${id}`); load(); } catch (e) { notify(e.message, 'info'); }
  };

  return (
    <div>
      <div className="admin-top"><div><h1>Coupons</h1><p className="muted">{rows.length} coupons</p></div></div>
      <div className="admin-card">
        <h3>{editing ? 'Edit coupon' : 'New coupon'}</h3>
        <form onSubmit={save} className="form-grid">
          <div className="field"><label>Code *</label><input className="input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
          <div className="field"><label>Type</label>
            <select className="select" style={{ width: '100%' }} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="percent">Percent (%)</option><option value="fixed">Fixed (TK)</option>
            </select>
          </div>
          <div className="field"><label>Value</label><input className="input" type="number" min="1" max="100" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></div>
          <div className="field"><label>Min order (TK)</label><input className="input" type="number" min="0" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })} /></div>
          <div className="field"><label>Max discount (TK, 0 = none)</label><input className="input" type="number" min="0" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })} /></div>
          <div className="field"><label>Usage limit (0 = unlimited)</label><input className="input" type="number" min="0" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })} /></div>
          <div className="field"><label>Start date</label><input className="input" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
          <div className="field"><label>End date</label><input className="input" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <label style={{ fontSize: 14 }}><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled</label>
            <button className="btn btn-rose btn-sm" type="submit">{editing ? 'Save' : 'Create'}</button>
            {editing && <button className="btn btn-ghost btn-sm" type="button" onClick={reset}>Cancel</button>}
          </div>
        </form>
      </div>
      <div className="admin-card" style={{ padding: 0 }}>
        <div className="table-scroll">
        <table className="admin-table">
          <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min order</th><th>Used</th><th>Dates</th><th>Enabled</th><th></th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><b>{c.code}</b></td>
                <td>{c.type}</td>
                <td>{c.type === 'percent' ? `${c.value}%` : `${c.value} TK`}</td>
                <td>{c.minOrder} TK</td>
                <td>{c.used_count}{c.usage_limit > 0 ? ` / ${c.usage_limit}` : ''}</td>
                <td className="small">{c.start_date || '—'} <i className="fa-solid fa-arrow-right" style={{ fontSize: 10, margin: '0 3px' }} /> {c.end_date || '∞'}</td>
                <td>{c.enabled ? <i className="fa-solid fa-circle-check" style={{ color: 'var(--green)' }} /> : '—'}</td>
                <td>
                  <button className="btn btn-outline btn-sm" onClick={() => { setEditing(c.id); setForm({ code: c.code, type: c.type, value: c.value, minOrder: c.min_order, maxDiscount: c.max_discount, usageLimit: c.usage_limit, startDate: c.start_date, endDate: c.end_date, enabled: !!c.enabled }); }}>Edit</button>
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