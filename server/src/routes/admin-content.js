const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, allowRoles } = require('../auth');
const { ok, fail, toNum, slugify, nowISO } = require('../utils');
const { parseJson } = require('../catalog');

const router = express.Router();
router.use(requireAuth);

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let sharp = null;
try { sharp = require('sharp'); } catch {}

// ---------------- Banners ----------------
router.get('/banners', (req, res) => {
  ok(res, db.prepare('SELECT * FROM banners ORDER BY sort_order, id').all());
});

router.post('/banners', allowRoles('admin', 'editor'), (req, res) => {
  const b = req.body || {};
  if (!String(b.title || '').trim()) return fail(res, 400, 'Banner title is required.');
  const info = db.prepare(`
    INSERT INTO banners (eyebrow, title, description, button_text, link, image, sort_order, enabled, start_date, end_date)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(String(b.eyebrow || ''), String(b.title).trim(), String(b.description || ''),
    String(b.buttonText || 'Shop Now'), String(b.link || '/shop'), String(b.image || ''),
    toNum(b.sortOrder, 0), b.enabled === false ? 0 : 1, String(b.startDate || ''), String(b.endDate || ''));
  ok(res, db.prepare('SELECT * FROM banners WHERE id=?').get(info.lastInsertRowid), { created: true });
});

router.put('/banners/:id', allowRoles('admin', 'editor'), (req, res) => {
  const id = toNum(req.params.id);
  if (!db.prepare('SELECT id FROM banners WHERE id=?').get(id)) return fail(res, 404, 'Banner not found');
  const b = req.body || {};
  db.prepare(`
    UPDATE banners SET eyebrow=?, title=?, description=?, button_text=?, link=?, image=?, sort_order=?, enabled=?, start_date=?, end_date=? WHERE id=?
  `).run(String(b.eyebrow ?? ''), String(b.title ?? ''), String(b.description ?? ''),
    String(b.buttonText ?? 'Shop Now'), String(b.link ?? '/shop'), String(b.image ?? ''),
    toNum(b.sortOrder ?? 0), b.enabled === false ? 0 : 1, String(b.startDate ?? ''), String(b.endDate ?? ''), id);
  ok(res, db.prepare('SELECT * FROM banners WHERE id=?').get(id), { updated: true });
});

router.delete('/banners/:id', allowRoles('admin'), (req, res) => {
  db.prepare('DELETE FROM banners WHERE id=?').run(toNum(req.params.id));
  ok(res, { deleted: true });
});

// ---------------- Journal ----------------
router.get('/journal', (req, res) => {
  ok(res, db.prepare('SELECT * FROM articles ORDER BY id DESC').all().map((a) => ({ ...a, tags: parseJson(a.tags_json), relatedProducts: parseJson(a.related_products_json) })));
});

router.post('/journal', allowRoles('admin', 'editor'), (req, res) => {
  const a = req.body || {};
  if (!String(a.title || '').trim()) return fail(res, 400, 'Article title is required.');
  const slug = uniqueArticleSlug(slugify(a.title));
  const tags = Array.isArray(a.tags) ? a.tags : parseJson(a.tags_json);
  const related = Array.isArray(a.relatedProducts) ? a.relatedProducts.map(Number).filter(Boolean) : [];
  const info = db.prepare(`
    INSERT INTO articles (title, slug, category, author, cover, excerpt, content, tags_json, related_products_json, published)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(String(a.title).trim(), slug, String(a.category || ''), String(a.author || 'Editorial Team'),
    String(a.cover || ''), String(a.excerpt || ''), String(a.content || ''),
    JSON.stringify(tags), JSON.stringify(related), a.published === false ? 0 : 1);
  ok(res, db.prepare('SELECT * FROM articles WHERE id=?').get(info.lastInsertRowid), { created: true });
});

function uniqueArticleSlug(s) {
  let slug = s || 'article';
  let i = 1;
  while (db.prepare('SELECT id FROM articles WHERE slug=?').get(slug)) slug = `${s}-${i++}`;
  return slug;
}

router.put('/journal/:id', allowRoles('admin', 'editor'), (req, res) => {
  const id = toNum(req.params.id);
  const existing = db.prepare('SELECT * FROM articles WHERE id=?').get(id);
  if (!existing) return fail(res, 404, 'Article not found');
  const a = req.body || {};
  let slug = String(existing.slug);
  if (a.title && String(a.title).trim() !== existing.title) slug = uniqueArticleSlug(slugify(a.title));
  const tags = Array.isArray(a.tags) ? a.tags : parseJson(existing.tags_json);
  const related = Array.isArray(a.relatedProducts) ? a.relatedProducts.map(Number).filter(Boolean) : parseJson(existing.related_products_json);
  db.prepare(`
    UPDATE articles SET title=?, slug=?, category=?, author=?, cover=?, excerpt=?, content=?, tags_json=?, related_products_json=?, published=?, updated_at=? WHERE id=?
  `).run(
    String(a.title ?? existing.title).trim(), slug,
    String(a.category ?? existing.category), String(a.author ?? existing.author),
    String(a.cover ?? existing.cover), String(a.excerpt ?? existing.excerpt), String(a.content ?? existing.content),
    JSON.stringify(tags), JSON.stringify(related), a.published === undefined ? existing.published : (a.published ? 1 : 0),
    nowISO(), id);
  ok(res, db.prepare('SELECT * FROM articles WHERE id=?').get(id), { updated: true });
});

router.delete('/journal/:id', allowRoles('admin'), (req, res) => {
  db.prepare('DELETE FROM articles WHERE id=?').run(toNum(req.params.id));
  ok(res, { deleted: true });
});

// ---------------- FAQs ----------------
router.get('/faqs', (req, res) => {
  ok(res, db.prepare('SELECT * FROM faqs ORDER BY section, sort_order, id').all().map((f) => {
    const c = { ...f };
    if (c.section === 'shipping' && c.question.includes('delivery charge')) { }
    return c;
  }));
});

router.post('/faqs', allowRoles('admin', 'editor'), (req, res) => {
  const f = req.body || {};
  if (!String(f.question || '').trim() || !String(f.answer || '').trim()) return fail(res, 400, 'Question and answer are required.');
  const info = db.prepare('INSERT INTO faqs (question, answer, section, sort_order) VALUES (?,?,?,?)').run(
    String(f.question).trim(), String(f.answer).trim(), String(f.section || 'general'), toNum(f.sortOrder, 0));
  ok(res, db.prepare('SELECT * FROM faqs WHERE id=?').get(info.lastInsertRowid), { created: true });
});

router.put('/faqs/:id', allowRoles('admin', 'editor'), (req, res) => {
  const id = toNum(req.params.id);
  const f = req.body || {};
  if (!String(f.question || '').trim()) return fail(res, 400, 'Question is required.');
  db.prepare('UPDATE faqs SET question=?, answer=?, section=?, sort_order=?, enabled=? WHERE id=?').run(
    String(f.question).trim(), String(f.answer ?? ''), String(f.section || 'general'),
    toNum(f.sortOrder, 0), f.enabled === false ? 0 : 1, id);
  ok(res, db.prepare('SELECT * FROM faqs WHERE id=?').get(id), { updated: true });
});

router.delete('/faqs/:id', allowRoles('admin'), (req, res) => {
  db.prepare('DELETE FROM faqs WHERE id=?').run(toNum(req.params.id));
  ok(res, { deleted: true });
});

// ---------------- Pages ----------------
router.get('/pages', (req, res) => {
  const rows = db.prepare("SELECT `key`, value FROM settings WHERE `key` LIKE 'page_%'").all();
  ok(res, Object.fromEntries(rows.map((r) => [r.key.replace('page_', ''), r.value])));
});

router.put('/pages/:key', allowRoles('admin', 'editor'), (req, res) => {
  const key = 'page_' + String(req.params.key).replace(/[^a-zA-Z]/, '');
  const value = String(req.body?.content ?? req.body ?? '');
  db.prepare('INSERT INTO settings (`key`, value) VALUES (?,?) ON CONFLICT(`key`) DO UPDATE SET value=excluded.value').run(key, value);
  ok(res, { saved: true, key });
});

// ---------------- Routine ----------------
router.get('/routine', (req, res) => {
  const questions = db.prepare('SELECT * FROM routine_questions ORDER BY sort_order, id').all();
  ok(res, questions.map((q) => ({
    ...q,
    options: db.prepare('SELECT * FROM routine_options WHERE question_id=? ORDER BY sort_order, id').all(q.id)
      .map((o) => {
        const result = db.prepare('SELECT * FROM routine_results WHERE option_id=?').get(o.id);
        return { ...o, result };
      })
  })));
});

router.put('/routine/:id', allowRoles('admin', 'editor'), (req, res) => {
  const id = toNum(req.params.id);
  const q = req.body || {};
  if (!String(q.question || '').trim()) return fail(res, 400, 'Question is required.');
  db.prepare('UPDATE routine_questions SET question=?, subtitle=?, multiple=?, sort_order=? WHERE id=?').run(
    String(q.question).trim(), String(q.subtitle || ''), q.multiple ? 1 : 0, toNum(q.sortOrder, 0), id);
  db.prepare('DELETE FROM routine_options WHERE question_id=?').run(id);
  (Array.isArray(q.options) ? q.options : []).forEach((o, i) => {
    const oinfo = db.prepare('INSERT INTO routine_options (question_id, label, value, sort_order) VALUES (?,?,?,?)').run(
      id, String(o.label || '').trim(), String(o.value || o.label || '').trim(), i + 1);
    db.prepare('INSERT INTO routine_results (option_id, category, tags_json, product_ids_json) VALUES (?,?,?,?)').run(
      oinfo.lastInsertRowid, String(o.category || ''), JSON.stringify(Array.isArray(o.tags) ? o.tags : []),
      JSON.stringify(Array.isArray(o.products) ? o.products.map(Number).filter(Boolean) : []));
  });
  ok(res, { saved: true });
});

// ---------------- Media ----------------
router.get('/media', (req, res) => {
  const folder = String(req.query.folder || '');
  const rows = folder
    ? db.prepare('SELECT * FROM media WHERE folder=? ORDER BY id DESC').all(folder)
    : db.prepare('SELECT * FROM media ORDER BY id DESC').all();
  const folders = db.prepare('SELECT DISTINCT folder FROM media').all().map((r) => r.folder);
  ok(res, rows, { folders });
});

function writeImage(name, buffer, mime) {
  const urlName = `${Date.now()}-${name.replace(/[^a-z0-9.-]/gi, '_').slice(-60)}`;
  const rel = `/uploads/${urlName}`;
  const abs = path.join(UPLOAD_DIR, urlName);
  let metadata = {};
  if (sharp && mime.startsWith('image/') && !mime.includes('gif')) {
    return sharp(buffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
      .then(async (buf) => {
        const webpName = urlName.replace(/\.(jpe?g|png|webp|avif)$/i, '') + '.webp';
        fs.writeFileSync(path.join(UPLOAD_DIR, webpName), buf);
        metadata = await sharp(buf).metadata();
        return { abs: path.join(UPLOAD_DIR, webpName), rel: `/uploads/${webpName}`, mime: 'image/webp', width: metadata.width, height: metadata.height, size: buf.length };
      });
  }
  fs.writeFileSync(abs, buffer);
  if (sharp) {
    return sharp(buffer).metadata().then((m) => ({ abs, rel, mime, width: m.width, height: m.height, size: buffer.length }));
  }
  return Promise.resolve({ abs, rel, mime, width: 0, height: 0, size: buffer.length });
}

router.post('/media/upload', allowRoles('admin', 'editor'), (req, res) => {
  const multer = require('multer');
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }).array('files', 12);
  upload(req, res, (err) => {
    if (err) return fail(res, 400, 'Upload failed. Max file size 15MB.');
    const files = req.files || [];
    const folder = String(req.body.folder || 'general').replace(/[^a-z0-9 _-]/gi, '').slice(0, 40) || 'general';
    const created = [];
    const insert = db.prepare('INSERT INTO media (filename, url, mime, size, width, height, folder) VALUES (?,?,?,?,?,?,?)');
    const tasks = files.map((f) => writeImage(f.originalname || 'file', f.buffer, f.mimetype).then((out) => {
      const info = insert.run(out.abs ? path.basename(out.abs) : path.basename(out.rel), out.rel, out.mime || f.mimetype, out.size, out.width, out.height, folder);
      created.push({ ...db.prepare('SELECT * FROM media WHERE id=?').get(info.lastInsertRowid) });
    }));
    Promise.all(tasks).then(() => ok(res, created), (e) => fail(res, 500, 'Image processing failed', e.message));
  });
});

router.put('/media/:id', allowRoles('admin', 'editor'), (req, res) => {
  const id = toNum(req.params.id);
  const row = db.prepare('SELECT * FROM media WHERE id=?').get(id);
  if (!row) return fail(res, 404, 'File not found');
  const b = req.body || {};
  const folder = String(b.folder || row.folder).replace(/[^a-z0-9 _-]/gi, '').slice(0, 40);
  db.prepare('UPDATE media SET folder=? WHERE id=?').run(folder, id);
  ok(res, { ...db.prepare('SELECT * FROM media WHERE id=?').get(id), moved: folder !== row.folder });
});

router.delete('/media/:id', allowRoles('admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM media WHERE id=?').get(toNum(req.params.id));
  if (!row) return fail(res, 404, 'File not found');
  db.prepare('DELETE FROM media WHERE id=?').run(row.id);
  if (row.url.startsWith('/uploads/')) {
    const abs = path.join(UPLOAD_DIR, path.basename(row.url));
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }
  ok(res, { deleted: true });
});

// ---------------- Settings ----------------
router.get('/settings', (req, res) => {
  const all = db.prepare('SELECT `key`, value FROM settings').all();
  const out = {};
  for (const r of all) { try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; } }
  const cx = db.prepare('SELECT * FROM contact_messages ORDER BY id DESC LIMIT 30').all();
  out.contactMessages = cx;
  out.admins = db.prepare('SELECT id, name, email, role, active, last_login_at, created_at FROM admins').all();
  out.newsletterCount = db.prepare('SELECT COUNT(*) c FROM newsletter').get().c;
  ok(res, out);
});

router.put('/settings/:key', allowRoles('admin', 'editor'), (req, res) => {
  const key = String(req.params.key).replace(/[^a-z]/gi, '');
  const value = JSON.stringify(req.body);
  db.prepare('INSERT INTO settings (`key`, value) VALUES (?,?) ON CONFLICT(`key`) DO UPDATE SET value=excluded.value').run(key, value);
  ok(res, { saved: true, key });
});

module.exports = router;