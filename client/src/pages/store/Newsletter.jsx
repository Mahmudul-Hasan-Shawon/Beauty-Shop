import React, { useState } from 'react';
import api from '../../api';
import { useApp } from '../../store';

export default function Newsletter() {
  const { notify } = useApp();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.includes('@')) return notify('Please enter a valid email.', 'info');
    setBusy(true);
    try {
      await api.post('/api/newsletter', { email });
      setEmail('');
      notify('You are subscribed!');
    } catch (err) {
      notify(err.message, 'info');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="newsletter">
      <div className="eyebrow" style={{ color: '#e8bfc4' }}>Join the inner circle</div>
      <h2>Get beauty tips & exclusive offers</h2>
      <p>Subscribe for product drops, ritual guides and members-only discounts.</p>
      <form onSubmit={submit}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address" required />
        <button className="btn btn-rose" disabled={busy}>{busy ? '…' : 'Subscribe'}</button>
      </form>
    </div>
  );
}