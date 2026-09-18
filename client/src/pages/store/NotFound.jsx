import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container">
      <div className="page-head" style={{ paddingTop: 80 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 80, color: 'var(--rose)', lineHeight: 1 }}>404</div>
        <h1>Page not found</h1>
        <p className="muted">The page you are looking for has moved or never existed. Let&apos;s get you back to beauty.</p>
        <div className="mt-2" style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Link className="btn btn-rose" to="/">Go Home</Link>
          <Link className="btn btn-outline" to="/shop">Shop Collection</Link>
        </div>
      </div>
    </div>
  );
}