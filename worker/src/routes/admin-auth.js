import { HttpError } from '../router.js';
import { requireAuth, requireRole } from '../auth.js';
import { hashPassword, verifyPassword } from '../password.js';
import { signToken } from '../jwt.js';
import { nowISO } from '../utils.js';

export function mount(router) {
  router.post('/api/auth/login', async (r, app) => {
    const email = String(r.body?.email || '').trim().toLowerCase();
    const password = String(r.body?.password || '');
    if (!email || !password) throw new HttpError(400, 'Enter your email and password.');
    const admin = await app.db.get('SELECT * FROM admins WHERE email=?', email);
    if (!admin || !admin.active || !(await verifyPassword(password, admin.password_hash))) {
      throw new HttpError(401, 'Invalid email or password.');
    }
    await app.db.run('UPDATE admins SET last_login_at=? WHERE id=?', nowISO(), admin.id);
    const token = await signToken(admin, app.secret);
    return { success: true, data: { token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } } };
  });

  router.get('/api/auth/me', async (r, app) => {
    const admin = await requireAuth(r, app);
    const perms = {
      admin: ['*'],
      editor: ['dashboard', 'products', 'categories', 'brands', 'banners', 'journal', 'media', 'settings', 'coupons', 'reviews'],
      order_manager: ['dashboard', 'orders', 'customers', 'reviews']
    };
    return { success: true, data: { admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }, permissions: perms[admin.role] || [] } };
  });

  router.put('/api/auth/password', async (r, app) => {
    const admin = await requireAuth(r, app);
    const current = String(r.body?.current || '');
    const next = String(r.body?.next || '');
    if (next.length < 6) throw new HttpError(400, 'New password must be at least 6 characters.');
    const record = await app.db.get('SELECT * FROM admins WHERE id=?', admin.id);
    if (!(await verifyPassword(current, record.password_hash))) throw new HttpError(401, 'Current password is incorrect.');
    await app.db.run('UPDATE admins SET password_hash=? WHERE id=?', await hashPassword(next), admin.id);
    return { success: true, data: { updated: true } };
  });
}