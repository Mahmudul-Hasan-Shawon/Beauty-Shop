const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth } = require('../auth');
const { ok, fail, nowISO } = require('../utils');

const router = express.Router();

router.post('/login', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return fail(res, 400, 'Enter your email and password.');
  const admin = db.prepare('SELECT * FROM admins WHERE email=?').get(email);
  if (!admin || !admin.active || !bcrypt.compareSync(password, admin.password_hash)) {
    return fail(res, 401, 'Invalid email or password.');
  }
  db.prepare('UPDATE admins SET last_login_at=? WHERE id=?').run(nowISO(), admin.id);
  const token = signToken(admin);
  ok(res, {
    token,
    admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
  });
});

router.get('/me', requireAuth, (req, res) => {
  const { id, name, email, role } = req.admin;
  const perms = {
    admin: ['*'],
    editor: ['dashboard', 'products', 'categories', 'brands', 'banners', 'journal', 'media', 'settings', 'coupons', 'reviews'],
    order_manager: ['dashboard', 'orders', 'customers', 'reviews']
  };
  ok(res, { admin: { id, name, email, role }, permissions: perms[req.admin.role] || [] });
});

router.put('/password', requireAuth, (req, res) => {
  const current = String(req.body?.current || '');
  const next = String(req.body?.next || '');
  if (next.length < 6) return fail(res, 400, 'New password must be at least 6 characters.');
  const admin = db.prepare('SELECT * FROM admins WHERE id=?').get(req.admin.id);
  if (!bcrypt.compareSync(current, admin.password_hash)) return fail(res, 401, 'Current password is incorrect.');
  db.prepare('UPDATE admins SET password_hash=? WHERE id=?').run(bcrypt.hashSync(next, 10), req.admin.id);
  ok(res, { updated: true });
});

module.exports = router;