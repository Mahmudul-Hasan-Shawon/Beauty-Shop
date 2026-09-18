import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useApp } from '../../store';

export default function Reviews() {
  const { notify } = useApp();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('pending');

  const load = () => {
    api.get('/api/admin/reviews', { status: filter }).then((r) => setRows(r.data || [])).catch(() => {});
  };
  useEffect(load, [filter]);

  const setStatus = async (id, status) => {
    try { await api.patch(`/api/admin/reviews/${id}`, { status }); notify('Updated'); load(); }
    catch (e) { notify(e.message, 'info'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this review?')) return;
    try { await api.del(`/api/admin/reviews/${id}`); load(); } catch (e) { notify(e.message, 'info'); }
  };

  return (
    <div>
      <div className="admin-top">
        <div><h1>Reviews</h1><p className="muted">{rows.length} shown</p></div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['pending', 'approved', 'rejected'].map((s) => (
            <button key={s} className={`tab ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>{s}</button>
          ))}
        </div>
      </div>
      <div className="admin-card" style={{ padding: 0 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <b>{r.customer_name}</b> <span className="muted small">· {r.productName}</span>
                <div style={{ color: 'var(--gold)', letterSpacing: 2 }}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <i key={i} className="fa-solid fa-star" style={{ fontSize: 12, color: i < r.rating ? 'var(--gold)' : '#e4d7cf', marginRight: 2 }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {filter !== 'approved' && <button className="btn btn-sm btn-rose" onClick={() => setStatus(r.id, 'approved')}>Approve</button>}
                {filter !== 'rejected' && <button className="btn btn-sm btn-outline" onClick={() => setStatus(r.id, 'rejected')}>Reject</button>}
                <button className="btn btn-sm btn-danger" onClick={() => del(r.id)}>Delete</button>
              </div>
            </div>
            {r.title && <div className="small" style={{ fontWeight: 600 }}>{r.title}</div>}
            <p className="muted" style={{ marginBottom: 0 }}>{r.text}</p>
          </div>
        ))}
        {!rows.length && <p className="center muted" style={{ padding: 30 }}>No reviews here.</p>}
      </div>
    </div>
  );
}