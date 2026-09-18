import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { dates } from '../../utils';
import { journalCover } from '../../images/journal';

export default function Journal() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/journal').then((r) => setArticles(r.data || [])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="container" style={{ maxWidth: 1000 }}>
      <div className="page-head">
        <div className="breadcrumb">The Journal</div>
        <h1>Skincare, decoded</h1>
        <p>Rituals, ingredient guides and honest advice for radiant skin.</p>
      </div>
      {loading && <div className="loading"><span className="spinner" /></div>}
      <div className="article-grid mt-2">
        {articles.map((a, i) => (
          <Link key={a.id} to={`/journal/${a.slug}`} className="article-card">
            <div className="cover"><img src={journalCover(a, i)} alt={a.title} loading="lazy" /></div>
            <div className="meta"><span>{a.category || 'Editorial'}</span><span>{dates(a.created_at)}</span></div>
            <h3>{a.title}</h3>
            <p className="excerpt">{a.excerpt}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}