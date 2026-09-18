import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { taka, dates } from '../../utils';

const STATUS_PILL = { pending: 'st-pending', confirmed: 'st-confirmed', processing: 'st-processing', shipped: 'st-shipped', out_for_delivery: 'st-out_for_delivery', delivered: 'st-delivered', cancelled: 'st-cancelled', returned: 'st-cancelled' };
const LABEL = {
  pending: 'Order Placed', confirmed: 'Confirmed', processing: 'Processing', shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery', delivered: 'Delivered', cancelled: 'Cancelled', returned: 'Returned'
};

export default function Dashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get('/api/admin/dashboard/overview').then((r) => setD(r.data)).catch(() => {});
  }, []);

  if (!d) return <div className="loading"><span className="spinner" /></div>;

  const cards = [
    ['Total Sales', taka(d.cards.totalSales), 'fa-coins'],
    ['Today', taka(d.cards.todaySales), 'fa-calendar-day'],
    ['Orders', d.cards.orders, 'fa-box-open'],
    ['Pending', d.cards.pendingOrders, 'fa-hourglass-half'],
    ['Customers', d.cards.customers, 'fa-users'],
    ['Products', d.cards.products, 'fa-spray-can'],
    ['Low Stock', d.cards.lowStock, 'fa-triangle-exclamation'],
    ['Pending Reviews', d.cards.pendingReviews, 'fa-star']
  ];

  const maxWeek = Math.max(1, ...d.week.map((w) => Number(w.sales)));

  return (
    <div>
      <div className="admin-top">
        <div><h1>Dashboard</h1><p className="muted">Store overview</p></div>
        <Link className="btn btn-outline btn-sm" to="/admin/products/new">+ New Product</Link>
      </div>

      <div className="stats-grid">
        {cards.map(([l, n, i]) => (
          <div className="stat-card" key={l}>
            <div className="lbl"><i className={`fa-solid ${i}`} style={{ marginRight: 6, color: 'var(--rose)', fontSize: 12 }} />{l}</div>
            <div className="num">{n}</div>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <h3>Sales — last 14 days</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140 }}>
          {d.week.map((w) => (
            <div key={w.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div title={`${taka(w.sales)} · ${w.orders} orders`} style={{ width: '100%', background: 'var(--rose)', borderRadius: '4px 4px 0 0', height: `${Math.max(4, (Number(w.sales) / maxWeek) * 110)}px`, opacity: 0.75 + (Number(w.sales) / maxWeek) * 0.25 }} />
              <span className="small muted" style={{ fontSize: 10 }}>{w.day?.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Recent orders</h3>
          <Link className="small" to="/admin/orders">View all <i className="fa-solid fa-arrow-right" style={{ fontSize: 10 }} /></Link>
        </div>
        <div className="table-scroll">
          <table className="admin-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {d.recentOrders.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/admin/orders/${o.id}`} style={{ color: 'var(--rose)' }}>{o.orderNo}</Link></td>
                  <td>{o.customer}<div className="small muted">{o.phone}</div></td>
                  <td className="small">{dates(o.date)}</td>
                  <td>{taka(o.total)}</td>
                  <td><span className={`status-pill ${STATUS_PILL[o.status] || 'st-pending'}`}>{LABEL[o.status] || o.status}</span></td>
                </tr>
              ))}
              {!d.recentOrders.length && <tr><td colSpan="5" className="center muted">No orders yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {d.lowStockItems.length > 0 && (
        <div className="admin-card">
          <h3>Low stock alert</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {d.lowStockItems.map((p) => (
              <Link key={p.id} to={`/admin/products/${p.id}`} style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
                <img src={p.thumbnail || '/placeholder.png'} alt="" style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover' }} onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                <div style={{ flex: 1 }}>
                  <b className="small">{p.title}</b>
                  <div className="small" style={{ color: 'var(--red)' }}>Only {p.stock} left</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}