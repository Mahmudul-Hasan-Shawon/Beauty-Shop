import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api';
import LegalPage from './LegalPage';

const LEGAL_KEYS = new Set(['privacy', 'terms']);

const FALLBACK = {
  about: ['About Petal & Rose', 'Petal & Rose was born from a simple belief: everyone deserves skincare that is authentic, effective and honest. We partner with authorized distributors to bring you genuine Korean and global beauty essentials, curated with the same care we would give our own shelves.', 'From serums to sunscreens, every product is verified before it reaches you — no gray market, no expired batches, no compromises.'],
  shipping: ['Shipping & Delivery', 'Inside Dhaka: delivery takes 1–2 working days and costs 60 TK. Outside Dhaka: delivery takes 2–4 working days and costs 120 TK.', 'Orders placed before 3 PM usually ship the same day. Track your order anytime from the Track Order page using your Order ID or phone number.'],
  returns: ['Returns & Refunds', 'Unopened, unused products can be returned within 7 days of delivery. Please reach out to support with your Order ID to arrange a return or exchange.', 'Refunds for pre-paid orders are processed to your original payment method within 3–5 working days of the returned item being received.']
};

export default function StaticPage() {
  const { key } = useParams();
  const [content, setContent] = useState(null);
  const fallback = FALLBACK[key] || [key, 'This page is being updated.'];

  if (LEGAL_KEYS.has(key)) return <LegalPage type={key} />;

  useEffect(() => {
    api.get(`/api/page/${key}`).then((r) => {
      const raw = r.data?.content || '';
      setContent(String(raw).split('\n').filter(Boolean).map((l) => l.trim()));
    }).catch(() => setContent(fallback.slice(1).flatMap((t, i) => (i === 0 ? [t] : [t]))));
  }, [key]);

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div className="breadcrumb">
          <Link to="/">Home</Link> / {fallback[0]}
        </div>
        <h1>{fallback[0]}</h1>
      </div>
      <div className="admin-card">
        {(content || []).map((block, i) => <p key={i} className={i === 0 ? '' : 'mt-1'} style={{ color: 'var(--ink-soft)', fontSize: 16 }}>{block}</p>)}
      </div>
    </div>
  );
}