import React, { useEffect, useRef, useState } from 'react';
import api from '../../api';
import { useApp } from '../../store';
import { dates } from '../../utils';

export default function Media() {
  const { notify } = useApp();
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [folders, setFolders] = useState([]);
  const [folder, setFolder] = useState('');
  const [busy, setBusy] = useState(false);

  const load = (f) => {
    api.get('/api/admin/media', { folder: f }).then((r) => {
      setRows(r.data || []);
      setFolders(r.meta?.folders || []);
    }).catch(() => {});
  };
  useEffect(() => { load(folder); }, [folder]);

  const upload = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('folder', folder || 'general');
      Array.from(files).forEach((f) => fd.append('files', f));
      const r = await fetch('/api/admin/media/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('pr-admin-token')}`, 'X-Customer': localStorage.getItem('pr-customer') || 'admin' },
        body: fd
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.message || 'Upload failed');
      notify(`Uploaded ${json.data.length} file(s)`);
      load(folder);
    } catch (e) { notify(e.message, 'info'); }
    finally { setBusy(false); }
  };

  const move = async (m, f) => {
    try { await api.put(`/api/admin/media/${m.id}`, { folder: f }); load(folder); } catch (e) { notify(e.message, 'info'); }
  };

  const del = async (m) => {
    if (!window.confirm('Delete this file?')) return;
    try { await api.del(`/api/admin/media/${m.id}`); load(folder); } catch (e) { notify(e.message, 'info'); }
  };

  return (
    <div>
      <div className="admin-top">
        <div><h1>Media library</h1><p className="muted">{rows.length} files · click to copy URL</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input ref={fileRef} type="file" multiple accept="image/*" hidden onChange={(e) => upload(e.target.files)} />
          <button className="btn btn-rose" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Uploading…' : '+ Upload images'}</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        <button className={`tab ${!folder ? 'active' : ''}`} onClick={() => setFolder('')}>All</button>
        {folders.map((f) => <button key={f} className={`tab ${folder === f ? 'active' : ''}`} onClick={() => setFolder(f)}>{f}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
        {rows.map((m) => (
          <div key={m.id} className="admin-card" style={{ padding: 10, marginBottom: 0 }}>
            {m.mime?.startsWith('image/')
              ? <img src={m.url} alt={m.filename} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }} onClick={() => { navigator.clipboard?.writeText(m.url); notify('URL copied'); }} />
              : <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--blush)', borderRadius: 8 }}><i className="fa-solid fa-file-lines" style={{ fontSize: 30, color: 'var(--ink-soft)' }} /></div>}
            <div className="small" style={{ marginTop: 8, wordBreak: 'break-all' }}>{m.filename}</div>
            <div className="small muted">{dates(m.created_at)} · {(m.size / 1024).toFixed(0)}KB</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button className="chip" onClick={() => { navigator.clipboard?.writeText(m.url); notify('URL copied'); }}>Copy URL</button>
              {folders.filter((x) => x !== folder).slice(0, 1).map((x) => (
                <button key={x} className="chip" onClick={() => move(m, x)}><i className="fa-solid fa-arrow-right" style={{ fontSize: 10, marginRight: 4 }} />{x}</button>
              ))}
              <button className="chip" style={{ color: 'var(--red)' }} onClick={() => del(m)}>Delete</button>
            </div>
          </div>
        ))}
        {!rows.length && <p className="muted" style={{ gridColumn: '1/-1' }}>No files yet. Upload a few images to get started.</p>}
      </div>
    </div>
  );
}