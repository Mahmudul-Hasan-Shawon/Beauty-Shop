import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api';
import { useApp } from '../../store';
import { taka, dates } from '../../utils';

export default function OrderDetail() {
  const { id } = useParams();
  const { notify } = useApp();
  const [o, setO] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/api/admin/orders/${id}`).then((r) => setO(r.data)).catch(() => window.location.href = '/admin/orders');
  }, [id]);

  if (!o) return <div className="loading"><span className="spinner" /></div>;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.put(`/api/admin/orders/${id}`, o);
      setO(r.data);
      notify('Order updated');
    } catch (ex) { notify(ex.message, 'info'); }
    finally { setBusy(false); }
  };

  const del = async () => {
    if (!window.confirm('Delete this order permanently?')) return;
    try { await api.del(`/api/admin/orders/${id}`); window.location.href = '/admin/orders'; } catch (e) { notify(e.message, 'info'); }
  };

  return (
    <div>
      <div className="admin-top">
        <div><h1>Order {o.order_no}</h1><p className="muted"><Link to="/admin/orders"><i className="fa-solid fa-arrow-left" style={{ fontSize: 11, marginRight: 4 }} />All orders</Link> · Placed {dates(o.created_at)}</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className={`status-pill st-${o.status}`}>{o.statusLabel}</span>
          <button className="btn btn-danger btn-sm" onClick={del}>Delete</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 22 }}>
        <div>
          <form className="admin-card" onSubmit={save}>
            <h3>Update order</h3>
            <div className="form-grid">
              <div className="field"><label>Status</label>
                <select className="select" style={{ width: '100%' }} value={o.status} onChange={(e) => setO({ ...o, status: e.target.value })}>
                  {o.statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="field"><label>Payment status</label>
                <select className="select" style={{ width: '100%' }} value={o.payment_status} onChange={(e) => setO({ ...o, payment_status: e.target.value })}>
                  <option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option>
                </select>
              </div>
              <div className="field"><label>Tracking number</label><input className="input" value={o.tracking_no || ''} onChange={(e) => setO({ ...o, tracking_no: e.target.value })} /></div>
              <div className="field"><label>Coupon</label><input className="input" disabled value={o.coupon_code || ''} /></div>
            </div>
            <div className="field"><label>Internal note</label><textarea value={o.admin_note || ''} onChange={(e) => setO({ ...o, admin_note: e.target.value })} /></div>
            <button className="btn btn-rose" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>
          </form>

          <div className="admin-card">
            <h3>Items</h3>
            {o.items.map((it) => (
              <div key={it.id} className="summary-row" style={{ borderBottom: '1px dashed var(--line)', padding: '10px 0', gap: 10 }}>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {it.image && <img src={it.image} alt="" style={{ width: 38, height: 42, borderRadius: 6, objectFit: 'cover' }} onError={(e) => { e.target.style.visibility = 'hidden'; }} />}
                  <span>{it.qty} × {it.title}{it.variant ? ` (${it.variant})` : ''}</span>
                </span>
                <span>{taka(it.price * it.qty)}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="admin-card">
            <h3>Totals</h3>
            <div className="summary-row"><span>Subtotal</span><span>{taka(o.subtotal)}</span></div>
            <div className="summary-row"><span>Delivery</span><span>{taka(o.shipping)}</span></div>
            {o.discount > 0 && <div className="summary-row" style={{ color: 'var(--green)' }}><span>Discount{o.coupon_code ? ` (${o.coupon_code})` : ''}</span><span>−{taka(o.discount)}</span></div>}
            <div className="summary-row total"><span>Total</span><span>{taka(o.total)}</span></div>
            <div className="small muted mt-1">Payment: {o.payment_method.toUpperCase()} · {o.payment_status}</div>
          </div>

          <div className="admin-card">
            <h3>Customer</h3>
            <p><b>{o.customer_name}</b><br /><span className="muted">{o.phone}</span>{o.email && <><br /><span className="muted">{o.email}</span></>}</p>
            <p className="muted" style={{ marginBottom: 0 }}>{o.address}{o.city ? `, ${o.city}` : ''}{o.area ? `, ${o.area}` : ''}{o.postal_code ? ` — ${o.postal_code}` : ''}</p>
          </div>

          {o.notes && (
            <div className="admin-card">
              <h3>Customer notes</h3>
              <p className="muted" style={{ marginBottom: 0 }}>{o.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}