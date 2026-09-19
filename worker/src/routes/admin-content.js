import { requireRole } from '../auth.js';
import { toNum, nowISO } from '../utils.js';
import { parseJson } from '../catalog.js';
import { HttpError } from '../router.js';

export function mount(router) {
  // ---------------- Banners ----------------
  router.get('/api/admin/banners', async (r, app) => {
    await requireRole(r, app, []);
    return { success: true, data: await app.db.all('SELECT * FROM banners ORDER BY sort_order, id') };
  });

  router.post('/api/admin/banners', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const b = r.body || {};
    if (!String(b.title || '').trim()) throw new HttpError(400, 'Banner title is required.');
    const info = await app.db.run(`
      INSERT INTO banners (eyebrow, title, description, button_text, link, image, sort_order, enabled, start_date, end_date)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `, String(b.eyebrow || ''), String(b.title).trim(), String(b.description || ''),
      String(b.buttonText || 'Shop Now'), String(b.link || '/shop'), String(b.image || ''),
      toNum(b.sortOrder, 0), b.enabled === false ? 0 : 1, String(b.startDate || ''), String(b.endDate || ''));
    return { success: true, data: await app.db.get('SELECT * FROM banners WHERE id=?', info.lastInsertRowid), meta: { created: true } };
  });

  router.put('/api/admin/banners/:id', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const id = toNum(r.params.id);
    if (!(await app.db.get('SELECT id FROM banners WHERE id=?', id))) throw new HttpError(404, 'Banner not found');
    const b = r.body || {};
    await app.db.run(`
      UPDATE banners SET eyebrow=?, title=?, description=?, button_text=?, link=?, image=?, sort_order=?, enabled=?, start_date=?, end_date=? WHERE id=?
    `, String(b.eyebrow ?? ''), String(b.title ?? ''), String(b.description ?? ''),
      String(b.buttonText ?? 'Shop Now'), String(b.link ?? '/shop'), String(b.image ?? ''),
      toNum(b.sortOrder ?? 0), b.enabled === false ? 0 : 1, String(b.startDate ?? ''), String(b.endDate ?? ''), id);
    return { success: true, data: await app.db.get('SELECT * FROM banners WHERE id=?', id), meta: { updated: true } };
  });

  router.delete('/api/admin/banners/:id', async (r, app) => {
    await requireRole(r, app, ['admin']);
    await app.db.run('DELETE FROM banners WHERE id=?', toNum(r.params.id));
    return { success: true, data: { deleted: true } };
  });

  // ---------------- Journal ----------------
  router.get('/api/admin/journal', async (r, app) => {
    await requireRole(r, app, []);
    const rows = await app.db.all('SELECT * FROM articles ORDER BY id DESC');
    return { success: true, data: rows.map((a) => ({ ...a, tags: parseJson(a.tags_json), relatedProducts: parseJson(a.related_products_json) })) };
  });

  router.post('/api/admin/journal', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const a = r.body || {};
    if (!String(a.title || '').trim()) throw new HttpError(400, 'Article title is required.');
    const slug = await uniqueArticleSlug(app, slugify(a.title));
    const tags = Array.isArray(a.tags) ? a.tags : parseJson(a.tags_json);
    const related = Array.isArray(a.relatedProducts) ? a.relatedProducts.map(Number).filter(Boolean) : [];
    const info = await app.db.run(`
      INSERT INTO articles (title, slug, category, author, cover, excerpt, content, tags_json, related_products_json, published)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `, String(a.title).trim(), slug, String(a.category || ''), String(a.author || 'Editorial Team'),
      String(a.cover || ''), String(a.excerpt || ''), String(a.content || ''),
      JSON.stringify(tags), JSON.stringify(related), a.published === false ? 0 : 1);
    return { success: true, data: await app.db.get('SELECT * FROM articles WHERE id=?', info.lastInsertRowid), meta: { created: true } };
  });

  router.put('/api/admin/journal/:id', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const id = toNum(r.params.id);
    const existing = await app.db.get('SELECT * FROM articles WHERE id=?', id);
    if (!existing) throw new HttpError(404, 'Article not found');
    const a = r.body || {};
    let slug = String(existing.slug);
    if (a.title && String(a.title).trim() !== existing.title) slug = await uniqueArticleSlug(app, slugify(a.title));
    const tags = Array.isArray(a.tags) ? a.tags : parseJson(existing.tags_json);
    const related = Array.isArray(a.relatedProducts) ? a.relatedProducts.map(Number).filter(Boolean) : parseJson(existing.related_products_json);
    await app.db.run(`
      UPDATE articles SET title=?, slug=?, category=?, author=?, cover=?, excerpt=?, content=?, tags_json=?, related_products_json=?, published=?, updated_at=? WHERE id=?
    `, String(a.title ?? existing.title).trim(), slug,
      String(a.category ?? existing.category), String(a.author ?? existing.author),
      String(a.cover ?? existing.cover), String(a.excerpt ?? existing.excerpt), String(a.content ?? existing.content),
      JSON.stringify(tags), JSON.stringify(related), a.published === undefined ? existing.published : (a.published ? 1 : 0),
      nowISO(), id);
    return { success: true, data: await app.db.get('SELECT * FROM articles WHERE id=?', id), meta: { updated: true } };
  });

  router.delete('/api/admin/journal/:id', async (r, app) => {
    await requireRole(r, app, ['admin']);
    await app.db.run('DELETE FROM articles WHERE id=?', toNum(r.params.id));
    return { success: true, data: { deleted: true } };
  });

  // ---------------- FAQs ----------------
  router.get('/api/admin/faqs', async (r, app) => {
    await requireRole(r, app, []);
    return { success: true, data: await app.db.all('SELECT * FROM faqs ORDER BY section, sort_order, id') };
  });

  router.post('/api/admin/faqs', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const f = r.body || {};
    if (!String(f.question || '').trim() || !String(f.answer || '').trim()) throw new HttpError(400, 'Question and answer are required.');
    const info = await app.db.run('INSERT INTO faqs (question, answer, section, sort_order) VALUES (?,?,?,?)',
      String(f.question).trim(), String(f.answer).trim(), String(f.section || 'general'), toNum(f.sortOrder, 0));
    return { success: true, data: await app.db.get('SELECT * FROM faqs WHERE id=?', info.lastInsertRowid), meta: { created: true } };
  });

  router.put('/api/admin/faqs/:id', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const id = toNum(r.params.id);
    const f = r.body || {};
    if (!String(f.question || '').trim()) throw new HttpError(400, 'Question is required.');
    await app.db.run('UPDATE faqs SET question=?, answer=?, section=?, sort_order=?, enabled=? WHERE id=?',
      String(f.question).trim(), String(f.answer ?? ''), String(f.section || 'general'),
      toNum(f.sortOrder, 0), f.enabled === false ? 0 : 1, id);
    return { success: true, data: await app.db.get('SELECT * FROM faqs WHERE id=?', id), meta: { updated: true } };
  });

  router.delete('/api/admin/faqs/:id', async (r, app) => {
    await requireRole(r, app, ['admin']);
    await app.db.run('DELETE FROM faqs WHERE id=?', toNum(r.params.id));
    return { success: true, data: { deleted: true } };
  });

  // ---------------- Pages ----------------
  router.get('/api/admin/pages', async (r, app) => {
    await requireRole(r, app, []);
    const rows = await app.db.all("SELECT `key`, value FROM settings WHERE `key` LIKE 'page_%'");
    return { success: true, data: Object.fromEntries(rows.map((row) => [row.key.replace('page_', ''), row.value])) };
  });

  router.put('/api/admin/pages/:key', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const key = 'page_' + String(r.params.key).replace(/[^a-zA-Z]/, '');
    const value = String(r.body?.content ?? r.body ?? '');
    await app.db.run('INSERT INTO settings (`key`, value) VALUES (?,?) ON CONFLICT(`key`) DO UPDATE SET value=excluded.value', key, value);
    return { success: true, data: { saved: true, key } };
  });

  // ---------------- Routine ----------------
  router.get('/api/admin/routine', async (r, app) => {
    await requireRole(r, app, []);
    const questions = await app.db.all('SELECT * FROM routine_questions ORDER BY sort_order, id');
    const out = [];
    for (const qx of questions) {
      const options = await app.db.all('SELECT * FROM routine_options WHERE question_id=? ORDER BY sort_order, id', qx.id);
      const optOut = [];
      for (const o of options) {
        const result = await app.db.get('SELECT * FROM routine_results WHERE option_id=?', o.id);
        optOut.push({ ...o, result });
      }
      out.push({ ...qx, options: optOut });
    }
    return { success: true, data: out };
  });

  router.put('/api/admin/routine/:id', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const id = toNum(r.params.id);
    const qx = r.body || {};
    if (!String(qx.question || '').trim()) throw new HttpError(400, 'Question is required.');
    await app.db.run('UPDATE routine_questions SET question=?, subtitle=?, multiple=?, sort_order=? WHERE id=?',
      String(qx.question).trim(), String(qx.subtitle || ''), qx.multiple ? 1 : 0, toNum(qx.sortOrder, 0), id);
    await app.db.run('DELETE FROM routine_options WHERE question_id=?', id);
    const options = Array.isArray(qx.options) ? qx.options : [];
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      const oinfo = await app.db.run('INSERT INTO routine_options (question_id, label, value, sort_order) VALUES (?,?,?,?)',
        id, String(o.label || '').trim(), String(o.value || o.label || '').trim(), i + 1);
      await app.db.run('INSERT INTO routine_results (option_id, category, tags_json, product_ids_json) VALUES (?,?,?,?)',
        oinfo.lastInsertRowid, String(o.category || ''), JSON.stringify(Array.isArray(o.tags) ? o.tags : []),
        JSON.stringify(Array.isArray(o.products) ? o.products.map(Number).filter(Boolean) : []));
    }
    return { success: true, data: { saved: true } };
  });

  // ---------------- Media ----------------
  router.get('/api/admin/media', async (r, app) => {
    await requireRole(r, app, []);
    const folder = String(r.query.folder || '');
    const rows = folder
      ? await app.db.all('SELECT * FROM media WHERE folder=? ORDER BY id DESC', folder)
      : await app.db.all('SELECT * FROM media ORDER BY id DESC');
    const folders = (await app.db.all('SELECT DISTINCT folder FROM media')).map((row) => row.folder);
    return { success: true, data: rows, meta: { folders } };
  });

  router.post('/api/admin/media/upload', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    if (!app.env.UPLOADS) throw new HttpError(400, 'Image uploads are not enabled yet. Enable R2 in your Cloudflare account, then this will work.');
    const body = r.body;
    if (!body) throw new HttpError(400, 'No files provided.');
    let files = [];
    let folder = 'general';
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      folder = String(body.get('folder') || 'general').replace(/[^a-z0-9 _-]/gi, '').slice(0, 40) || 'general';
      const all = body.getAll('files');
      files = all.filter((v) => v instanceof File);
      if (!files.length && body.get('files') instanceof File) files = [body.get('files')];
      if (!files.length) {
        for (const [key, val] of body.entries()) {
          if (val instanceof File) files.push(val);
        }
      }
    }
    if (!files.length) throw new HttpError(400, 'No files provided in the upload.');
    const created = [];
    for (const f of files) {
      const urlName = `${Date.now()}-${String(f.name || 'file').replace(/[^a-z0-9.-]/gi, '_').slice(-60)}`;
      const bytes = await f.arrayBuffer();
      await app.env.UPLOADS.put(urlName, bytes, {
        httpMetadata: { contentType: f.type || 'application/octet-stream' }
      });
      const url = `${app.publicBase}/uploads/${urlName}`;
      const info = await app.db.run('INSERT INTO media (filename, url, mime, size, width, height, folder) VALUES (?,?,?,?,?,?,?)',
        urlName, url, f.type || 'application/octet-stream', bytes.byteLength, 0, 0, folder);
      created.push({ id: info.lastInsertRowid, filename: urlName, url, mime: f.type || 'application/octet-stream', size: bytes.byteLength, width: 0, height: 0, folder });
    }
    if (!created.length) throw new HttpError(400, 'No files uploaded.');
    return { success: true, data: created };
  });

  router.put('/api/admin/media/:id', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const id = toNum(r.params.id);
    const row = await app.db.get('SELECT * FROM media WHERE id=?', id);
    if (!row) throw new HttpError(404, 'File not found');
    const b = r.body || {};
    const folder = String(b.folder || row.folder).replace(/[^a-z0-9 _-]/gi, '').slice(0, 40);
    await app.db.run('UPDATE media SET folder=? WHERE id=?', folder, id);
    const updated = await app.db.get('SELECT * FROM media WHERE id=?', id);
    return { success: true, data: { ...updated, moved: folder !== row.folder } };
  });

  router.delete('/api/admin/media/:id', async (r, app) => {
    await requireRole(r, app, ['admin']);
    const row = await app.db.get('SELECT * FROM media WHERE id=?', toNum(r.params.id));
    if (!row) throw new HttpError(404, 'File not found');
    await app.db.run('DELETE FROM media WHERE id=?', row.id);
    try {
      const key = row.url.split('/').pop();
      await app.env.UPLOADS.delete(key);
    } catch {}
    return { success: true, data: { deleted: true } };
  });

  // ---------------- Settings ----------------
  router.get('/api/admin/settings', async (r, app) => {
    await requireRole(r, app, []);
    const all = await app.db.all('SELECT `key`, value FROM settings');
    const out = {};
    for (const row of all) { try { out[row.key] = JSON.parse(row.value); } catch { out[row.key] = row.value; } }
    out.contactMessages = await app.db.all('SELECT * FROM contact_messages ORDER BY id DESC LIMIT 30');
    out.admins = await app.db.all('SELECT id, name, email, role, active, last_login_at, created_at FROM admins');
    out.newsletterCount = (await app.db.get('SELECT COUNT(*) c FROM newsletter')).c;
    return { success: true, data: out };
  });

  router.put('/api/admin/settings/:key', async (r, app) => {
    await requireRole(r, app, ['admin', 'editor']);
    const key = String(r.params.key).replace(/[^a-z]/gi, '');
    await app.db.run('INSERT INTO settings (`key`, value) VALUES (?,?) ON CONFLICT(`key`) DO UPDATE SET value=excluded.value', key, JSON.stringify(r.body || {}));
    return { success: true, data: { saved: true, key } };
  });
}

async function uniqueArticleSlug(app, s) {
  let slug = s || 'article';
  let i = 1;
  while (await app.db.get('SELECT id FROM articles WHERE slug=?', slug)) slug = `${s}-${i++}`;
  return slug;
}

function slugify(str) {
  return String(str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'item';
}