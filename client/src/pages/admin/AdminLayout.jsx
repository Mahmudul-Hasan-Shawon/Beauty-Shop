import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import api from '../../api';

const NAV = [
  ['/admin', 'Dashboard', 'fa-gauge-high', true],
  ['/admin/products', 'Products', 'fa-box'],
  ['/admin/categories', 'Categories', 'fa-folder'],
  ['/admin/brands', 'Brands', 'fa-tag'],
  ['/admin/orders', 'Orders', 'fa-box-open'],
  ['/admin/customers', 'Customers', 'fa-users'],
  ['/admin/reviews', 'Reviews', 'fa-star'],
  ['/admin/coupons', 'Coupons', 'fa-ticket'],
  ['/admin/banners', 'Banners', 'fa-image'],
  ['/admin/journal', 'Journal', 'fa-newspaper'],
  ['/admin/faqs', 'FAQs', 'fa-circle-question'],
  ['/admin/pages', 'Pages', 'fa-file-lines'],
  ['/admin/routine', 'Routine Quiz', 'fa-wand-magic-sparkles'],
  ['/admin/media', 'Media', 'fa-photo-film'],
  ['/admin/settings', 'Settings', 'fa-gear']
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem('pr-admin-token')) {
      window.location.href = '/admin/login';
      return;
    }
    api.get('/api/auth/me').then((r) => setMe(r.data)).catch(() => {
      localStorage.removeItem('pr-admin-token');
      window.location.href = '/admin/login';
    });
  }, []);

  const logout = () => {
    localStorage.removeItem('pr-admin-token');
    window.location.href = '/admin/login';
  };

  if (!me) return <div className="loading"><span className="spinner" /></div>;

  return (
    <div className="admin">
      <aside className="admin-side">
        <div className="brand">Petal &amp; Rose</div>
        {NAV.map(([to, label, ico, exact]) => (
          <NavLink key={to} to={to} end={!!exact} className={({ isActive }) => (isActive ? 'nav active' : 'nav')}>
            <i className={`fa-solid ${ico}`} /> {label}
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        <a className="nav" href="/" target="_blank" rel="noreferrer"><i className="fa-solid fa-arrow-up-right-from-square" /> View Store</a>
        <button className="nav" style={{ background: 'none', border: 0, textAlign: 'left', color: '#b8a99f' }} onClick={logout}>
          <i className="fa-solid fa-power-off" /> Sign out
        </button>
      </aside>
      <main className="admin-main">
        <Outlet context={{ me }} />
      </main>
    </div>
  );
}