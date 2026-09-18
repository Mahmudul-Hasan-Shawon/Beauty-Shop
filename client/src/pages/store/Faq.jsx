import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';

export default function Faq() {
  const [faqs, setFaqs] = useState([]);
  const [section, setSection] = useState('all');

  useEffect(() => {
    api.get('/api/faqs').then((r) => setFaqs(r.data || [])).catch(() => {});
  }, []);

  const sections = useMemo(() => ['all', ...new Set(faqs.map((f) => f.section || 'general'))], [faqs]);
  const list = section === 'all' ? faqs : faqs.filter((f) => (f.section || 'general') === section);

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div className="breadcrumb">Help Center</div>
        <h1>Frequently asked questions</h1>
        <p>Everything you need to know about ordering, shipping and more.</p>
      </div>
      <div className="center mt-2 mb-2">
        {sections.map((s) => (
          <button key={s} className={`tab ${section === s ? 'active' : ''}`} onClick={() => setSection(s)} style={{ margin: 3 }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      <div className="faq-list">
        {list.map((f) => (
          <details className="faq-item" key={f.id}>
            <summary>{f.question}</summary>
            <div className="ans">{f.answer}</div>
          </details>
        ))}
      </div>
      <div className="faq-cta reveal in">
        <h3>Still have a question?</h3>
        <p>We&apos;re happy to talk through skincare advice, orders, or delivery details.</p>
        <Link to="/contact" className="faq-cta-btn"><i className="fa-brands fa-whatsapp" /><span>Contact Us</span></Link>
      </div>
    </div>
  );
}