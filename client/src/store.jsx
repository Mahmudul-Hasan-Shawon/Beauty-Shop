import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import api from './api';

const Ctx = createContext(null);

const CART_KEY = 'pr-cart';
const WISH_KEY = 'pr-wish';

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export function AppProvider({ children }) {
  const [settings, setSettings] = useState({ store: {}, paymentMethods: [], shipping: null });
  const [cart, setCart] = useState(() => load(CART_KEY, []));
  const [wish, setWish] = useState(() => load(WISH_KEY, []));
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem(WISH_KEY, JSON.stringify(wish)); }, [wish]);

  useEffect(() => {
    let alive = true;
    api.get('/api/settings/public').then((r) => { if (alive && r?.data) setSettings(r.data); }).catch(() => {});
    if (alive) api.get('/api/banners').then((r) => { if (alive) setSettings((s) => ({ ...s, banners: r.data || [] })); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const notify = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    window.clearTimeout(notify._t);
    notify._t = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const addToCart = useCallback((p, qty = 1, variant = null) => {
    setCart((prev) => {
      const item = {
        productId: p.id, name: p.name || p.title, slug: p.slug, image: p.thumbnail || (p.images && p.images[0]),
        price: Number(p.salePrice || p.price || 0), oldPrice: Number(p.originalPrice || p.price || 0),
        stock: Number(p.stock || 0), variant: variant || p.size || ''
      };
      const found = prev.find((i) => i.productId === item.productId && i.variant === item.variant);
      let next;
      if (found) {
        next = prev.map((i) => (i === found ? { ...i, qty: Math.min(99, i.qty + qty) } : i));
      } else {
        next = [...prev, { ...item, qty }];
      }
      return next;
    });
    setCartOpen(true);
    notify('Added to bag');
  }, [notify]);

  const updateQty = useCallback((productId, variant, qty) => {
    setCart((prev) => qty <= 0
      ? prev.filter((i) => !(i.productId === productId && i.variant === variant))
      : prev.map((i) => (i.productId === productId && i.variant === variant ? { ...i, qty: Math.min(99, qty) } : i)));
  }, []);

  const removeItem = useCallback((productId, variant) => {
    setCart((prev) => prev.filter((i) => !(i.productId === productId && i.variant === variant)));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleWish = useCallback(async (p) => {
    let inList = wish.some((w) => w.id === p.id);
    if (inList) {
      setWish((prev) => prev.filter((w) => w.id !== p.id));
      api.del(`/api/wishlist/${p.id}`).catch(() => {});
      notify('Removed from wishlist', 'info');
    } else {
      setWish((prev) => [...prev, {
        id: p.id, name: p.name || p.title, slug: p.slug, thumbnail: p.thumbnail || (p.images && p.images[0]),
        price: Number(p.price || 0), salePrice: Number(p.salePrice || p.price || 0), discount: p.discount || 0,
        inStock: p.inStock, brand: p.brand?.name || ''
      }]);
      api.post('/api/wishlist', { productId: p.id }).then((r) => api.get('/api/wishlist').then((x) => { if (x.data) setWish(x.data); })).catch(() => {});
      notify('Saved to wishlist');
    }
  }, [wish, notify]);

  const cartMeta = useMemo(() => {
    const count = cart.reduce((s, i) => s + i.qty, 0);
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    return { count, subtotal, items: cart };
  }, [cart]);

  const value = useMemo(() => ({
    settings, setSettings, cart, cartMeta, addToCart, updateQty, removeItem, clearCart,
    wish, toggleWish, cartOpen, setCartOpen, toast, notify, searchOpen, setSearchOpen, menuOpen, setMenuOpen
  }), [settings, cart, cartMeta, addToCart, updateQty, removeItem, clearCart, wish, toggleWish, cartOpen, toast, notify, searchOpen, menuOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  return useContext(Ctx);
}