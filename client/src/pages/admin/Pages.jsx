import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useApp } from '../../store';
import { Link } from 'react-router-dom';

export default function Pages() {
  const { notify } = useApp();
  const [pages, setPages] = useState({});
  const [key, setKey] = useState('about');
  const [text, setText] = useState('');
  const [saved, setSaved] = useState({});

  useEffect(() => {
    api.get('/api/admin/pages').then((r) => {
      setPages(r.data || {});
      setSaved(r.data || {});
      setText(r.data[key] || '');
    }).catch(() => {});
  }, []);

  const select = (k) => {
    setKey(k);
    setText(saved[k] || '');
  };

  const save = async () => {
    try {
      await api.put(`/api/admin/pages/${key}`, { content: text });
      const next = { ...saved, [key]: text };
      setSaved(next); setPages(next);
      notify('Page saved');
    } catch (e) { notify(e.message, 'info'); }
  };

  const keys = Object.keys(pages).length ? Object.keys(pages) : ['about', 'shipping', 'returns', 'privacy', 'terms'];

  return (
    <div>
      <div className="admin-top"><div><h1>Pages</h1><p className="muted">Static pages served at /page/:key</p></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 22 }}>
        <div className="admin-card" style={{ padding: 12, alignSelf: 'start' }}>
          {keys.map((k) => (
            <button key={k} className="nav" style={{ display: 'block', width: '100%', textAlign: 'left', background: k === key ? 'var(--rose-light)' : 'none', border: 0, borderRadius: 8, padding: '10px 12px', fontSize: 14, marginBottom: 4 }}>
              <span onClick={() => select(k)}>{k}</span>
            </button>
          ))}
          <Link className="muted small" to={`/page/${key}`} target="_blank"><i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 10, marginRight: 4 }} />Preview /page/{key}</Link>
        </div>
        <div className="admin-card">
          <h3>Content — /page/{key}</h3>
          <textarea style={{ minHeight: 320, width: '100%', border: '1px solid var(--line)', borderRadius: 10, padding: 14, fontFamily: 'monospace', fontSize: 13 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Each line becomes a paragraph.\n\nAbout, shipping, returns, privacy, terms…'} />
          <button className="btn btn-rose mt-2" onClick={save}>Save Page</button>
        </div>
      </div>
    </div>
  );
}