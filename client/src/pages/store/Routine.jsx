import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import ProductCard from '../../components/store/ProductCard';
import { useApp } from '../../store';

export default function Routine() {
  const { settings, notify } = useApp();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [step, setStep] = useState(0);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  const intro = settings.routineIntro || {};

  useEffect(() => {
    api.get('/api/routine.txt').then((r) => setQuiz(r.data || [])).catch(() => {});
  }, []);

  const current = quiz?.[step];

  const select = (oid, multiple) => {
    setAnswers((prev) => {
      if (!multiple) return [...prev.slice(0, step), oid];
      const cur = prev.slice(0, step);
      const has = (prev[step] || []);
      const list = Array.isArray(has) ? has : [];
      const next = list.includes(oid) ? list.filter((x) => x !== oid) : [...list, oid];
      return [...cur, next.length && multiple ? next : (multiple ? next : []), ...(multiple ? [] : [])];
    });
    if (!multiple) {
      window.setTimeout(() => setStep((s) => s + 1), 150);
    }
  };

  const next = () => {
    const a = answers[step];
    const ok = Array.isArray(a) ? a.length > 0 : a != null;
    if (!ok) return notify('Please choose an answer to continue.', 'info');
    setStep((s) => Math.min(quiz.length - 1, s + 1));
  };

  const flatten = () => {
    const out = [];
    answers.forEach((a) => { if (Array.isArray(a)) out.push(...a); else if (a != null) out.push(a); });
    return out;
  };

  const solve = async () => {
    setBusy(true);
    try {
      const r = await api.post('/api/routine/solve', { answers: flatten() });
      setResults(r.data);
    } catch (e) {
      notify(e.message, 'info');
    } finally {
      setBusy(false);
    }
  };

  if (results) {
    return (
      <div className="container">
        <div className="page-head">
          <div className="breadcrumb">Find Your Routine</div>
          <h1>Your routine is ready</h1>
          <p>{results.explanation || 'We found products matched to your skin profile.'}</p>
        </div>
        <div className="product-grid">
          {results.products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
        <div className="center mt-3">
          <button className="btn btn-outline" onClick={() => { setResults(null); setAnswers([]); setStep(0); }}>Retake Quiz</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div className="breadcrumb">Personalization</div>
        <h1>{intro.heading || 'A routine built around you'}</h1>
        <p>{intro.description || 'Answer a few questions and we will curate the perfect beauty shelf for your skin.'}</p>
      </div>

      {!quiz && <div className="loading"><span className="spinner" /></div>}

      {quiz && !current && (
        <div className="admin-card center">
          <h3>All set!</h3>
          <p className="muted">Let&apos;s build your personalised routine.</p>
          <button className="btn btn-rose" onClick={solve} disabled={busy}>{busy ? 'Curating…' : 'Show My Products'}</button>
        </div>
      )}

      {quiz && current && (
        <div className="quiz-card">
          <div className="progress-dots">
            {quiz.map((_, i) => <i key={i} className={i <= step ? 'done' : ''} />)}
          </div>
          <div className="eyebrow">Question {step + 1} of {quiz.length}</div>
          <h2>{current.question}</h2>
          {current.subtitle && <p className="muted">{current.subtitle}</p>}
          <div className="mt-2">
            {current.options.map((o) => {
              const sel = answers[step];
              const active = Array.isArray(sel) ? sel.includes(o.id) : sel === o.id;
              return (
                <button key={o.id} type="button" className="quiz-option" style={active ? { borderColor: 'var(--rose)', background: 'var(--rose-light)' } : {}} onClick={() => select(o.id, !!current.multiple)}>
                  <span>{o.label}</span>
                  <span style={{ color: active ? 'var(--rose)' : '#d9c9c0' }}>{active ? '●' : '○'}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3" style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {step > 0 && <button className="btn btn-outline" onClick={() => setStep((s) => s - 1)}>Back</button>}
            <button className="btn btn-rose" onClick={next}>Continue <i className="fa-solid fa-arrow-right" /></button>
          </div>
        </div>
      )}
    </div>
  );
}