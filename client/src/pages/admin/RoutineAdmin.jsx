import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useApp } from '../../store';

export default function RoutineAdmin() {
  const { notify } = useApp();
  const [questions, setQuestions] = useState([]);
  const [products, setProducts] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/admin/routine').then((r) => setQuestions(r.data || [])).catch(() => {});
    api.get('/api/admin/products', { perPage: 50 }).then((r) => setProducts(r.data || [])).catch(() => {});
  }, []);

  const save = async (q, newQuestion, newOptions) => {
    setBusy(true);
    try {
      await api.put(`/api/admin/routine/${q.id}`, { ...q, question: newQuestion, options: newOptions });
      api.get('/api/admin/routine').then((r) => setQuestions(r.data || [])).catch(() => {});
      notify('Routine question saved');
    } catch (e) { notify(e.message, 'info'); }
    finally { setBusy(false); }
  };

  const addQuestion = async () => {
    if (!draft.trim()) return notify('Enter a question first.', 'info');
    try {
      await api.put('/api/admin/routine/0', { question: draft, subtitle: '', multiple: 0, options: [] });
      setDraft('');
      api.get('/api/admin/routine').then((r) => setQuestions(r.data || [])).catch(() => {});
      notify('Question added');
    } catch (e) { notify(e.message, 'info'); }
  };

  const Patch = ({ q }) => {
    const [title, setTitle] = useState(q.question);
    const [opts, setOpts] = useState((q.options || []).map((o) => {
    let tags = []; try { tags = JSON.parse(o.result?.tags_json || '[]'); } catch {}
    let pids = []; try { pids = JSON.parse(o.result?.product_ids_json || '[]'); } catch {}
    return { id: o.id, label: o.label, value: o.value, category: o.result?.category || '', tags, products: pids };
  }));

    const setOpt = (i, patch) => setOpts(opts.map((o, j) => (j === i ? { ...o, ...patch } : o)));
    const toggleProduct = (oi, pid) => setOpt(oi, { products: opts[oi].products.includes(pid) ? opts[oi].products.filter((x) => x !== pid) : [...opts[oi].products, pid] });

    return (
      <div className="admin-card">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn btn-rose btn-sm" disabled={busy} onClick={() => save(q, title, opts)}>Save</button>
        </div>
        {opts.map((o, i) => (
          <div key={o.id} style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div className="form-grid">
              <div className="field"><label>Label</label><input className="input" value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} /></div>
              <div className="field"><label>Value</label><input className="input" value={o.value} onChange={(e) => setOpt(i, { value: e.target.value })} /></div>
              <div className="field"><label>Category tag</label><input className="input" value={o.category} onChange={(e) => setOpt(i, { category: e.target.value })} /></div>
              <div className="field"><label>Product tags (comma sep)</label><input className="input" value={(o.tags || []).join(', ')} onChange={(e) => setOpt(i, { tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></div>
            </div>
            <div className="field"><label>Recommended products</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }} data-lenis-prevent>
                {products.map((p) => (
                  <button key={p.id} type="button" className="chip" style={o.products.includes(p.id) ? { background: 'var(--rose)', color: '#fff' } : {}} onClick={() => toggleProduct(i, p.id)}>{p.title.slice(0, 30)}</button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="admin-top"><div><h1>Routine quiz</h1><p className="muted">Questions shown in the Find Your Routine quiz</p></div></div>
      <div className="admin-card" style={{ display: 'flex', gap: 8 }}>
        <input className="input" placeholder="New question…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn btn-rose" onClick={addQuestion}>+ Add</button>
      </div>
      {questions.map((q) => <Patch key={q.id} q={q} />)}
    </div>
  );
}