import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { taka, dates } from '../../utils';

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState([]);

  const q = params.get('q') || '';
  const status = params.get('status') || '';
  const page = Number(params.get('page')) || 1;

  useEffect(() => {
    setLoading(true);
    api.get('/api/admin/orders', { q, status, page, perPage: 20 })
      .then((r) => { setRows(r.data || []); setMeta(r.meta || {}); })
      .catch(() => {})
      .finally(() => setLoading(false));
    if (!statuses.length) {
      api.get('/api/store/statuses').then((r) => setStatuses([]));
      api.get('/api/statuses').then((r) => setStatuses(r.data || [])).catch(() => {});
    }
  }, [q, status, page]);

  const setParam = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== 'page') n.delete('page');
    setParams(n, { replace: true });
  };

  return (
    <div>
      <div className="admin-top"><div><h1>Orders</h1><p className="muted">{meta.total} orders</p></div></div>
      <div className="admin-card" style={{ padding: '16px 22px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Search order no / name / phone…" value={q} onChange={(e) => setParam('q', e.target.value)} />
        <select className="select" value={status} onChange={(e) => setParam('status', e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div className="admin-card" style={{ padding: 0, overflowX: 'auto' }}>
        <div className="table-scroll">
          <table className="admin-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Payment</th><th>Total</th><th>Method</th><th>Status</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="7" className="center"><span className="spinner" /></td></tr>}
              {!loading && rows.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/admin/orders/${o.id}`} style={{ color: 'var(--rose)' }}><b>{o.order_no}</b></Link></td>
                  <td>{o.customer_name}<div className="small muted">{o.phone}</div></td>
                  <td className="small">{dates(o.created_at)}</td>
                  <td><span className={`status-pill ${o.payment_status === 'paid' ? 'st-delivered' : 'st-pending'}`}>{o.payment_status}</span></td>
                  <td>{taka(o.total)}</td>
                  <td className="small">{o.payment_method.toUpperCase()}</td>
                  <td><span className={`status-pill st-${o.status}`}>{o.statusLabel}</span></td>
                </tr>
              ))}
              {!loading && !rows.length && <tr><td colSpan="7" className="center muted">No orders found.</td></tr>}
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