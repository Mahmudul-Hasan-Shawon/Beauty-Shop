import React, { useEffect, useState } from 'react';
import api from '../../api';
import { taka, dates } from '../../utils';

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setLoading(true);
      api.get('/api/admin/customers', { q }).then((r) => setRows(r.data || [])).catch(() => { }).finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  return (
    <div>
      <div className="admin-top"><div><h1>Customers</h1><p className="muted">{rows.length} shown</p></div></div>
      <div className="admin-card" style={{ padding: '16px 22px' }}>
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search name / phone / email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="admin-card" style={{ padding: 0, overflowX: 'auto' }}>
        <div className="table-scroll">
        <table className="admin-table">
          <thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Total spent</th><th>Last order</th><th>Joined</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan="6" className="center"><span className="spinner" /></td></tr>}
            {!loading && rows.map((c) => (
              <tr key={c.id}>
                <td><b>{c.name || '—'}</b>{c.email && <div className="small muted">{c.email}</div>}</td>
                <td>{c.phone || '—'}</td>
                <td>{c.orderCount || 0}</td>
                <td>{taka(c.totalSpent || 0)}</td>
                <td className="small">{c.lastOrder ? dates(c.lastOrder) : '—'}</td>
                <td className="small">{dates(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}