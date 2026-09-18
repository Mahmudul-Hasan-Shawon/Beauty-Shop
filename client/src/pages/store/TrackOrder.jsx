import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api';
import { taka, dates } from '../../utils';

const FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
const LABEL = {
  pending: 'Order Placed', confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery', delivered: 'Delivered', cancelled: 'Cancelled', returned: 'Returned'
};

export default function TrackOrder() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const query = params.get('q');
    if (query) { setQ(query); search(query); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(query = q) {
    if (!query.trim()) return;
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      const r = await api.get('/api/track', { q: query });
      setResult(r.data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div className="breadcrumb">Customer Care / Track Order</div>
        <h1>Track your order</h1>
        <p>Enter your Order ID (e.g. PRXXXXXXXX) or the phone number you ordered with.</p>
      </div>

      <div className="track-card">
        <form className="admin-card" style={{ display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); search(); }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order ID or phone number" />
          <button className="btn btn-rose" disabled={busy}>{busy ? '…' : 'Track'}</button>
        </form>

        {err && <div className="alert error">{err}</div>}

        {result && result.map((o) => {
          const idx = FLOW.indexOf(o.status);
          const cancelled = o.status === 'cancelled' || o.status === 'returned';
          return (
            <div className="admin-card" key={o.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <b style={{ fontFamily: '"Manrope", sans-serif', fontSize: 17, fontWeight: 700, letterSpacing: '.04em' }}>{o.order_no}</b>
                <span className={`status-pill st-${o.status}`}>{o.statusLabel || LABEL[o.status]}</span>
              </div>
              <div className="muted small">Placed {dates(o.created_at)} · {o.payment_method.toUpperCase()} · {taka(o.total)}</div>

              {cancelled ? (
                <div className="alert error mt-2">{o.status === 'cancelled' ? 'This order was cancelled.' : 'This order was returned.'}</div>
              ) : (
                <div className="status-dots">
                  {FLOW.map((s, i) => {
                    const done = i <= idx;
                    const now = i === idx;
                    return (
                      <div key={s} className={`dot ${done ? 'done' : ''} ${now ? 'now' : ''}`}>
                        <span className="circle">{done ? <i className="fa-solid fa-check" style={{ fontSize: 12 }} /> : i + 1}</span>
                        <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{LABEL[s]}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {o.address && <p className="small muted mt-2">Deliver to: {o.address}{o.city ? `, ${o.city}` : ''}</p>}
              {o.tracking_no && <p className="small muted">Tracking: <b>{o.tracking_no}</b></p>}

              <div className="mt-2">
                <b className="small">Items</b>
                {o.items.map((it) => (
                  <div key={it.id} className="summary-row" style={{ borderBottom: '1px dashed var(--line)', padding: '8px 0', gap: 10 }}>
                    <span>{it.qty} × {it.title}{it.variant ? ` (${it.variant})` : ''}</span>
                    <span>{taka(it.price * it.qty)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}