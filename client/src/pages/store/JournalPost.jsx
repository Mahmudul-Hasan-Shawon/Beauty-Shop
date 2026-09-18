import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api';
import ProductCard from '../../components/store/ProductCard';
import { dates } from '../../utils';
import { journalCover } from '../../images/journal';

export default function JournalPost() {
  const { slug } = useParams();
  const [a, setA] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get(`/api/journal/${slug}`).then((r) => setA(r.data)).catch((e) => setErr(e.message));
  }, [slug]);

  if (err) return <div className="container"><div className="page-head"><h1>Not found</h1><p className="muted">{err}</p></div></div>;
  if (!a) return <div className="loading"><span className="spinner" /></div>;

  return (
    <div className="container">
      <div className="page-head">
        <div className="breadcrumb"><Link to="/journal">Journal</Link> / {a.category || 'Editorial'}</div>
        <h1>{a.title}</h1>
        <p className="muted">By {a.author} · {dates(a.created_at)}</p>
      </div>
      <div className="article-body">
        <div className="cover"><img src={journalCover(a)} alt={a.title} /></div>
        <p>{a.excerpt}</p>
        {(a.content || '').split('\n\n').filter(Boolean).map((para, i) => <p key={i}>{para}</p>)}
        {a.tags?.length > 0 && <div className="mt-2">{a.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</div>}
      </div>
      {a.relatedProducts?.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Shop the routine</h2></div>
          <div className="product-grid">{a.relatedProducts.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      )}
      {a.recommended?.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="section-head"><h2>Editor&apos;s picks</h2></div>
          <div className="product-grid">{a.recommended.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      )}
    </div>
  );
}