import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store';
import api from '../../api';
import { taka } from '../../utils';
import { veilGo } from '../../lib/veilBus';

export default function SearchOverlay() {
  const { searchOpen, setSearchOpen } = useApp();
  const [q, setQ] = useState('');
  const [sugs, setSugs] = useState([]);
  const [popular, setPopular] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (searchOpen) {
      setQ('');
      setSugs([]);
      api.get('/api/products/popular').then((r) => setPopular(r.data || [])).catch(() => {});
    }
  }, [searchOpen]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const term = q.trim();
      if (!term) { setSugs([]); return; }
      api.get('/api/products/suggest', { q: term })
        .then((r) => setSugs(r.data || []))
        .catch(() => setSugs([]));
    }, 200);
    return () => window.clearTimeout(t);
  }, [q]);

  const go = (path) => {
    setSearchOpen(false);
    veilGo(path, navigate);
  };

  if (!searchOpen) return null;
  return (
    <div className="search-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}>
      <div className="search-panel">
        <div className="search-input">
          <span style={{ fontSize: 20, color: 'var(--rose)' }}><i className="fa-solid fa-magnifying-glass" /></span>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') go(`/shop${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); }}
            placeholder="Search skincare, serums, sunscreens…" />
          <button className="icon-btn" onClick={() => setSearchOpen(false)}><i className="fa-solid fa-xmark" /></button>
        </div>
        {(sugs.length > 0 || (!sugs.length && q.trim())) && (
          <div className="suggestions">
            {sugs.map((s) => (
              <div key={s.id} className="sug-row" onClick={() => go(`/product/${s.slug}`)}>
                <img src={s.thumbnail || '/placeholder.png'} alt="" onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                <div>
                  <b>{s.name}</b>
                  <div className="small muted">{s.brand ? `${s.brand} · ` : ''}{taka(s.salePrice)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!q.trim() && popular.length > 0 && (
          <div className="popular">
            {popular.map((t) => (
              <button key={t} className="chip" onClick={() => go(`/shop?q=${encodeURIComponent(t)}`)}>{t}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}