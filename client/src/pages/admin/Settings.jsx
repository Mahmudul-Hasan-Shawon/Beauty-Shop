import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useApp } from '../../store';
import { dates } from '../../utils';

const KEYS = ['store', 'shipping', 'payment', 'tax', 'notifications', 'seo', 'hero', 'routineIntro'];

export default function Settings() {
  const { notify } = useApp();
  const [all, setAll] = useState({});
  const [tab, setTab] = useState('store');
  const [text, setText] = useState('');
  const [meta, setMeta] = useState({ admins: [], contactMessages: [], newsletterCount: 0 });

  useEffect(() => {
    api.get('/api/admin/settings').then((r) => {
      setAll(r.data || {});
      setText(JSON.stringify(r.data?.store || {}, null, 2));
      setMeta(r.data || {});
    }).catch(() => {});
  }, [tab]);

  const select = (k) => {
    setTab(k);
    setText(JSON.stringify(all[k] ?? {}, null, 2));
  };

  const save = async () => {
    try {
      const value = JSON.parse(text);
      await api.put(`/api/admin/settings/${tab}`, value);
      setAll((prev) => ({ ...prev, [tab]: value }));
      notify('Settings saved');
    } catch (e) {
      notify(e.message && e.status ? e.message : 'Invalid JSON — please check the format.', 'info');
    }
  };

  const preview = () => {
    try { return JSON.parse(text); } catch { return null; }
  };
  const p = preview();

  return (
    <div>
      <div className="admin-top"><div><h1>Settings</h1><p className="muted">Newsletter subscribers: {meta.newsletterCount || 0}</p></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 22 }}>
        <div className="admin-card" style={{ padding: 12, alignSelf: 'start' }}>
          {KEYS.map((k) => (
            <button key={k} className="nav" style={{ display: 'block', width: '100%', textAlign: 'left', background: tab === k ? 'var(--rose-light)' : 'none', border: 0, borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--ink)', textTransform: 'capitalize', marginBottom: 4 }} onClick={() => select(k)}>
              {k}
            </button>
          ))}
        </div>
        <div>
          <div className="admin-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, textTransform: 'capitalize' }}>{tab}</h3>
              <button className="btn btn-rose" onClick={save}>Save {tab}</button>
            </div>
            {tab === 'store' && p && (
              <div className="alert info mt-2">
                Store name: <b>{p.name}</b> · currency: <b>{p.currency}</b> · phone: {p.phone}<br />
                email: {p.email} · address: {p.address}
              </div>
            )}
            {tab === 'payment' && p && p.methods && (
              <div className="mt-2">
                {p.methods.map((m, i) => (
                  <div key={m.id || i} className="summary-row" style={{ borderBottom: '1px dashed var(--line)', padding: '8px 0' }}>
                    <span>{m.label} <span className="small muted">({m.id})</span></span>
                    <span className={`status-pill ${m.enabled ? 'st-delivered' : 'st-cancelled'}`}>{m.enabled ? 'enabled' : 'disabled'}</span>
                  </div>
                ))}
              </div>
            )}
            <textarea className="mt-2" style={{ width: '100%', minHeight: tab === 'payment' || tab === 'store' ? 260 : 320, border: '1px solid var(--line)', borderRadius: 10, padding: 14, fontFamily: 'monospace', fontSize: 13 }} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
            <p className="small muted">Edit as JSON. Keys: {tab === 'payment' ? '"methods": [{ "id": "cod", "label": "...", "enabled": true, "instruction": "..." }]' : 'see structure above'}</p>
          </div>

          <div className="admin-card">
            <h3>Team members</h3>
            <div className="table-scroll">
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last login</th></tr></thead>
              <tbody>
                {(meta.admins || []).map((a) => (
                  <tr key={a.id}><td>{a.name}</td><td>{a.email}</td><td>{a.role}</td><td className="small">{a.last_login_at ? dates(a.last_login_at) : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>

          {meta.contactMessages?.length > 0 && (
            <div className="admin-card">
              <h3>Recent contact messages</h3>
              {meta.contactMessages.map((m) => (
                <div key={m.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
                  <b>{m.name}</b> <span className="small muted">{m.email} · {dates(m.created_at)}</span>
                  {m.subject && <div className="small" style={{ fontWeight: 600 }}>{m.subject}</div>}
                  <p className="muted small" style={{ margin: '4px 0 0' }}>{m.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}