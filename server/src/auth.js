const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'petal-rose-dev-secret-change-me';
const TOKEN_TTL = process.env.TOKEN_TTL || '8h';

function signToken(admin) {
  return jwt.sign({ id: admin.id, email: admin.email, role: admin.role, name: admin.name }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function parseToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const payload = parseToken(req);
  if (!payload) return res.status(401).json({ success: false, message: 'Authentication required' });
  const admin = db.prepare('SELECT id, name, email, role, active FROM admins WHERE id=?').get(payload.id);
  if (!admin || !admin.active) return res.status(401).json({ success: false, message: 'Account disabled' });
  const fresh = jwt.sign({ id: admin.id, email: admin.email, role: admin.role, name: admin.name }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  req.admin = admin;
  req.token = fresh;
  next();
}

function allowRoles(...roles) {
  const allowed = new Set(roles);
  return (req, res, next) => {
    if (!req.admin) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (req.admin.role === 'admin') return next();
    if (allowed.has(req.admin.role)) return next();
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
  };
}

module.exports = { JWT_SECRET, signToken, parseToken, requireAuth, allowRoles };