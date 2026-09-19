import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useApp } from '../../store';

export default function Login() {
  const navigate = useNavigate();
  const { notify } = useApp();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api.post('/api/auth/login', form);
      localStorage.setItem('pr-admin-token', r.data.token);
      notify('Welcome back!');
      window.location.href = '/admin';
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-login" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#141210', padding: 20 }}>
      <form className="admin-card" style={{ width: 380 }} onSubmit={submit}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div className="brand" style={{ color: 'var(--ink)', fontSize: 22 }}>Petal <em>&</em> Rose</div>
          <p className="muted small">Admin Console</p>
        </div>
        {err && <div className="alert error">{err}</div>}
        <div className="field"><label>Email</label><input className="input" type="email" autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="field"><label>Password</label><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <button className="btn btn-rose btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="small muted center mt-2">Default login: admin@petalrose.com / Admin@12345</p>
      </form>
    </div>
  );
}