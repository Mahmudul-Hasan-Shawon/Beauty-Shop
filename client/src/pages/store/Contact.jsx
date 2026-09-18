import React, { useState } from 'react';
import api from '../../api';
import { useApp } from '../../store';

const REASONS = ['Order help', 'Product question', 'Returns & refunds', 'Partnership', 'Other'];

export default function Contact() {
  const { settings, notify } = useApp();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', reason: '', message: '' });
  const store = settings.store || {};

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        name: form.name,
        email: form.email,
        subject: form.reason || 'General inquiry',
        message: `${form.message}\n\nPhone: ${form.phone || '—'}`
      };
      await api.post('/api/contact', body);
      setForm({ name: '', email: '', phone: '', reason: '', message: '' });
      setSent(true);
      notify('Message sent! We will reply shortly.');
    } catch (err) {
      notify(err.message, 'info');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <div className="page-head">
        <div className="breadcrumb">Contact</div>
        <h1>How can we help you?</h1>
        <p>Tell us about your order, a product, or anything else — we get back to you within one business day.</p>
      </div>

      <div className="contact-layout">
        <aside className="contact-panel">
          <div className="cp-glow cp-glow-a" aria-hidden="true" />
          <div className="cp-glow cp-glow-b" aria-hidden="true" />
          <div className="cp-inner">
            <div className="cp-brand">
              <span className="cp-brand-icon"><i className="fa-solid fa-spa" /></span>
              <span>Petal <em>&amp;</em> Rose</span>
            </div>
            <h3>Beauty advice, order updates, or a little reassurance — we're here for you.</h3>
            <div className="cp-points">
              <p><i className="fa-solid fa-arrow-right" /> Questions about a product, your order, or our ingredients? Just ask — no question is too small.</p>
              <p><i className="fa-solid fa-arrow-right" /> Need help with returns, exchanges, or tracking? Share your Order ID and we'll sort it out quickly.</p>
            </div>
            <div className="cp-divider" />
            <p className="cp-cta">Contact Petal &amp; Rose for help with orders, product recommendations, returns, or partnership. We reply fast, in Bengali or English.</p>
            <div className="cp-meta">
              <span><i className="fa-solid fa-phone" /> {store.phone || '+880 1874 460244'}</span>
              <span><i className="fa-solid fa-envelope" /> {store.email || 'hello@petalrose.com'}</span>
              <span><i className="fa-solid fa-location-dot" /> {store.address || 'Gulshan 1, Dhaka'}</span>
            </div>
          </div>
        </aside>

        <section className="contact-card">
          {sent ? (
            <div className="contact-done">
              <p className="fi"><i className="fa-solid fa-circle-check" /></p>
              <h3>Thank you, message sent.</h3>
              <p className="muted">Your message is with our team. If we need more details we'll reach you at your email or phone.</p>
              <button className="btn btn-rose" onClick={() => setSent(false)}>Send another message</button>
            </div>
          ) : (
            <form onSubmit={submit} aria-label="Send us a message">
              <h3 className="contact-card-title">Send us a message</h3>
              <div className="form-grid">
                <div className="field"><label>Your name *</label><input className="input" required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="field"><label>Your email *</label><input className="input" required type="email" placeholder="you@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div className="form-grid">
                <div className="field"><label>Phone number</label><input className="input" type="tel" placeholder="01XXXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="field"><label>What is this about?</label>
                  <select className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                    <option value="">Select a topic</option>
                    {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="field"><label>Tell us more *</label><textarea required placeholder="Describe your question or request, and include your Order ID if you have one." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
              <button className="btn btn-rose btn-block" disabled={busy}>{busy ? 'Sending…' : 'Send Message'}</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}