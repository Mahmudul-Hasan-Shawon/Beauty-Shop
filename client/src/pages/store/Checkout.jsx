import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../store';
import api from '../../api';
import { taka } from '../../utils';
import { veilGo } from '../../lib/veilBus';

export default function Checkout() {
  const { cartMeta, clearCart, settings, notify } = useApp();
  const navigate = useNavigate();
  const shipping = settings.shipping || {};
  const paymentMethods = settings.paymentMethods || [];

  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', city: '', area: '', postalCode: '', notes: '', shippingRegion: 'inside', paymentMethod: paymentMethods[0]?.id || 'cod' });
  const [coupon, setCoupon] = useState('');
  const [couponInfo, setCouponInfo] = useState(null);
  const [couponMsg, setCouponMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null);

  const subtotal = cartMeta.subtotal;
  const freeThreshold = Number(shipping.freeThreshold) || 2500;
  const shippingFee = subtotal >= freeThreshold ? 0 : (form.shippingRegion === 'outside' ? (Number(shipping.outsideFee) || 120) : (Number(shipping.insideFee) || 60));
  const couponDiscount = couponInfo?.discount || 0;
  const total = subtotal + shippingFee - couponDiscount;

  const items = useMemo(() => cartMeta.items.map((i) => ({
    productId: i.productId, name: i.name, price: i.price, qty: i.qty, variant: i.variant, image: i.image
  })), [cartMeta.items]);

  const validateCoupon = async () => {
    if (!coupon.trim()) return;
    try {
      const r = await api.post('/api/coupon/validate', { code: coupon, subtotal });
      setCouponInfo(r.data);
      setCouponMsg('');
      notify(`Coupon applied: ${r.data.label}`);
    } catch (e) {
      setCouponInfo(null);
      setCouponMsg(e.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!items.length) return notify('Your bag is empty.', 'info');
    setBusy(true);
    try {
      const r = await api.post('/api/checkout', { ...form, items, couponCode: coupon });
      clearCart();
      setOrder(r.data);
    } catch (err) {
      notify(err.message || 'Checkout failed. Please try again.', 'info');
    } finally {
      setBusy(false);
    }
  };

  if (order) {
    return (
      <div className="container" style={{ maxWidth: 560, paddingTop: 40 }}>
        <div className="admin-card center">
          <div style={{ fontSize: 54, color: 'var(--green)' }}><i className="fa-solid fa-circle-check" /></div>
          <h1 style={{ fontSize: 28 }}>Order Placed!</h1>
          <p className="muted">Thank you for shopping with Petal &amp; Rose. Your order is confirmed and our team will call you to confirm delivery.</p>
          <div className="center mt-2">
            <div className="prices" style={{ justifyContent: 'center' }}><span className="price" style={{ fontSize: 20 }}>{taka(order.total)}</span></div>
            <div className="muted mt-1">Order ID</div>
            <b style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>{order.orderNo}</b>
            <p className="muted small mt-2">We also sent the details to WhatsApp number {form.phone || 'your phone'}.</p>
          </div>
          <div className="mt-3" style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-rose" onClick={() => veilGo('/track?q=' + order.orderNo, navigate)}>Track This Order</button>
            <button className="btn btn-outline" onClick={() => veilGo('/shop', navigate)}>Continue Shopping</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 30 }}>
      <div className="page-head">
        <div className="breadcrumb"><Link to="/cart">Bag</Link> / Checkout</div>
        <h1>Checkout</h1>
      </div>

      {items.length === 0 ? (
        <div className="admin-card center" style={{ maxWidth: 560, margin: '0 auto' }}>
          <h3>Your bag is empty</h3>
          <p className="muted">Add a few favourites before checking out.</p>
          <button className="btn btn-rose mt-1" onClick={() => veilGo('/shop', navigate)}>Browse Products</button>
        </div>
      ) : (
        <div className="shop-layout" style={{ gridTemplateColumns: '1.1fr 1fr' }}>
          <form onSubmit={submit}>
            <div className="checkout-card">
              <h3>Delivery details</h3>
              <div className="form-grid">
                <div className="field"><label>Full name *</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="field"><label>Phone *</label><input className="input" required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" /></div>
              </div>
              <div className="field"><label>Email (optional)</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="field"><label>Full address *</label><input className="input" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="House, road, area, landmark" /></div>
              <div className="form-grid">
                <div className="field"><label>City *</label><input className="input" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div className="field"><label>Area / Thana</label><input className="input" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
              </div>
              <div className="form-grid">
                <div className="field"><label>Postal code</label><input className="input" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div>
                <div className="field"><label>Delivery area</label>
                  <select className="select" style={{ width: '100%' }} value={form.shippingRegion} onChange={(e) => setForm({ ...form, shippingRegion: e.target.value })}>
                    <option value="inside">Inside Dhaka</option>
                    <option value="outside">Outside Dhaka</option>
                  </select>
                </div>
              </div>
              <div className="field"><label>Order notes (optional)</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. TrxID for bKash payment, or delivery preferences" /></div>
            </div>

            <div className="checkout-card">
              <h3>Payment method</h3>
              {(paymentMethods.length ? paymentMethods : [{ id: 'cod', label: 'Cash on Delivery', instruction: 'Pay in cash when your order arrives.' }]).map((m) => (
                <div key={m.id} className={`pay-opt ${form.paymentMethod === m.id ? 'active' : ''}`} onClick={() => setForm({ ...form, paymentMethod: m.id })}>
                  <input className="radio" type="radio" checked={form.paymentMethod === m.id} readOnly />
                  <div>
                    <b>{m.label}</b>
                    {m.instruction && <p>{m.instruction}</p>}
                    {m.number && <p><b>{m.number}</b></p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="checkout-card">
              <h3>Coupon</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" placeholder="Enter coupon code" value={coupon} onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setCouponInfo(null); }} />
                <button type="button" className="btn btn-outline" onClick={validateCoupon}>Apply</button>
              </div>
              {couponMsg && <p className="small" style={{ color: 'var(--red)' }}>{couponMsg}</p>}
              {couponInfo && <p className="small" style={{ color: 'var(--green)' }}><i className="fa-solid fa-circle-check" /> {couponInfo.label} applied — you save {taka(couponInfo.discount)}</p>}
            </div>

            <button className="btn btn-rose btn-lg btn-block" disabled={busy}>
              {busy ? 'Placing order…' : `Place Order · ${taka(total)}`}
            </button>
          </form>

          <aside className="filters" style={{ position: 'sticky', top: 92 }}>
            <div className="admin-card">
              <h3>Order summary</h3>
              {items.map((i) => (
                <div key={`${i.productId}-${i.variant}-${i.qty}`} className="summary-row" style={{ borderBottom: '1px dashed var(--line)', paddingBottom: 8, gap: 8 }}>
                  <span>{i.qty} × {i.name}{i.variant ? ` (${i.variant})` : ''}</span>
                  <span>{taka(i.price * i.qty)}</span>
                </div>
              ))}
              <div className="summary-row mt-2"><span>Subtotal</span><span>{taka(subtotal)}</span></div>
              <div className="summary-row"><span>Delivery</span><span>{shippingFee === 0 ? 'FREE' : taka(shippingFee)}</span></div>
              {couponDiscount > 0 && <div className="summary-row" style={{ color: 'var(--green)' }}><span>Coupon</span><span>−{taka(couponDiscount)}</span></div>}
              <div className="summary-row total"><span>Total</span><span>{taka(total)}</span></div>
            </div>
            <p className="small muted">By placing this order you agree to our <Link to="/page/terms">terms</Link>. We confirm every order by phone before dispatch.</p>
          </aside>
        </div>
      )}
    </div>
  );
}