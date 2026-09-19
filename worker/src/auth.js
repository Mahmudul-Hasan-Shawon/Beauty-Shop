import { verifyToken, signToken } from './jwt.js';
import { HttpError } from './router.js';

export async function requireAuth(r, app) {
  const header = r.headers.Authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (r.body?.token || '');
  const payload = await verifyToken(token, app.secret);
  if (!payload) throw new HttpError(401, 'Authentication required');
  const admin = await app.db.get('SELECT id, name, email, role, active FROM admins WHERE id=?', Number(payload.id) || 0);
  if (!admin || !admin.active) throw new HttpError(401, 'Account disabled');
  r.admin = admin;
  return admin;
}

export async function requireRole(r, app, roles) {
  const admin = await requireAuth(r, app);
  if (admin.role === 'admin') return admin;
  if (Array.isArray(roles) && roles.includes(admin.role)) return admin;
  throw new HttpError(403, 'You do not have permission to perform this action');
}