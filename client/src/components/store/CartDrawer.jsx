import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../store';
import { taka } from '../../utils';
import { veilGo } from '../../lib/veilBus';

export default function CartDrawer({ open }) {
  const { cartMeta, setCartOpen, updateQty, removeItem } = useApp();
  const navigate = useNavigate();

  return (
    <>
      <div className={`drawer-backdrop ${open ? 'open' : ''}`} onClick={() => setCartOpen(false)} />
      <aside className={`drawer ${open ? 'open' : ''}`}>
        <div className="drawer-head">
          <h2 style={{ margin: 0, fontSize: 20 }}>Your Bag ({cartMeta.count})</h2>
          <button className="icon-btn" onClick={() => setCartOpen(false)}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="drawer-body" data-lenis-prevent>
          {cartMeta.items.length === 0 && (
            <p className="muted center mt-3">Your bag is empty. Let&apos;s find something you&apos;ll love.</p>
          )}
          {cartMeta.items.map((i) => (
            <div className="cart-line" style={{ border: 0, borderBottom: '1px solid var(--line)', borderRadius: 0, padding: '14px 0', marginBottom: 0 }} key={`${i.productId}-${i.variant}`}>
              <Link to={`/product/${i.slug}`} onClick={() => setCartOpen(false)}>
                <img src={i.image || '/placeholder.png'} alt={i.name} onError={(e) => { e.target.src = '/placeholder.png'; }} />
              </Link>
              <div className="mid">
                <div className="name">{i.name}</div>
                {i.variant && <div className="variant">Size: {i.variant}</div>}
                <div className="small muted">{taka(i.price)}</div>
                <div className="qty" style={{ marginTop: 8 }}>
                  <button onClick={() => updateQty(i.productId, i.variant, i.qty - 1)}>−</button>
                  <span>{i.qty}</span>
                  <button onClick={() => updateQty(i.productId, i.variant, i.qty + 1)}>+</button>
                </div>
              </div>
              <button className="icon-btn" onClick={() => removeItem(i.productId, i.variant)} aria-label="remove"><i className="fa-solid fa-trash-can" /></button>
            </div>
          ))}
        </div>
        <div className="drawer-foot">
          <div className="summary-row"><span>Subtotal</span><span>{taka(cartMeta.subtotal)}</span></div>
          <div className="summary-row total"><span>Total</span><span>{taka(cartMeta.subtotal)}</span></div>
          <div className="mt-2" style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => { setCartOpen(false); veilGo('/shop', navigate); }}>Keep Shopping</button>
            <button
              className="btn btn-rose"
              style={{ flex: 1 }}
              disabled={!cartMeta.items.length}
              onClick={() => { setCartOpen(false); veilGo('/checkout', navigate); }}
            >Checkout</button>
          </div>
        </div>
      </aside>
    </>
  );
}