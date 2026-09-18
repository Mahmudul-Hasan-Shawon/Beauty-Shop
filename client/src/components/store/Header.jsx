import React, { useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../store';
import { veilGo } from '../../lib/veilBus';
import { scrollTopSmooth } from '../../lib/smooth';

export default function Header() {
  const { settings, cartMeta, setCartOpen, setSearchOpen, menuOpen, setMenuOpen, wish } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const store = settings.store || {};

  // on the home page, Brands smooth-scrolls to the hero (top); elsewhere it navigates
  const goBrands = () => {
    if (location.pathname === '/') {
      scrollTopSmooth();
      return;
    }
    veilGo('/brands', navigate);
  };

  const goHome = (e) => {
    if (location.pathname === '/') {
      e.preventDefault();
      e.stopPropagation();
      scrollTopSmooth();
    }
  };

  const links = [
    { to: '/', label: 'Home' },
    { to: '/shop', label: 'Shop' },
    { to: '/brands', label: 'Brands' },
    { to: '/journal', label: 'Journal' },
    { to: '/routine', label: 'Find Your Routine' },
    { to: '/faqs', label: 'FAQs' },
    { to: '/contact', label: 'Contact' }
  ];

  const search = (
    <button className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="search"><i className="fa-solid fa-magnifying-glass" /></button>
  );
  const track = (
    <NavLink to="/track" className="icon-btn" aria-label="track order"><i className="fa-solid fa-truck-fast" /></NavLink>
  );
  const wishBtn = (
    <button className="icon-btn" onClick={() => veilGo('/shop?wishlist=1', navigate)} aria-label="wishlist">{wish.length > 0 && <span className="badge">{wish.length}</span>}<i className="fa-solid fa-heart" /></button>
  );
  const cart = (
    <button className="icon-btn" onClick={() => setCartOpen(true)} aria-label="cart">
      {cartMeta.count > 0 && <span className="badge">{cartMeta.count}</span>}
      <i className="fa-solid fa-bag-shopping" />
    </button>
  );

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="header-logo" onClick={goHome}>
          <span>Petal <em>&</em> Rose</span>
        </Link>

        <nav className="nav-links">
          {links.map((l) =>
            l.to === '/brands'
              ? <a key={l.to} href="#" className={location.pathname === '/brands' ? 'active' : ''} onClick={(e) => { e.preventDefault(); e.stopPropagation(); goBrands(); }}>{l.label}</a>
              : <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>{l.label}</NavLink>
          )}
        </nav>

        <div className="header-actions">
          {search}{track}{wishBtn}{cart}
        </div>
      </div>

      <div className={`mobile-dock ${menuOpen ? 'open' : ''}`}>
        <button className="icon-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="menu">
          {menuOpen ? <i className="fa-solid fa-xmark" /> : <i className="fa-solid fa-bars" />}
        </button>
        {search}{track}{wishBtn}{cart}
      </div>

      {menuOpen && (
        <div className="mobile-nav-overlay" onClick={() => setMenuOpen(false)}>
          <nav className="mobile-nav-list">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)}>{l.label}</Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
