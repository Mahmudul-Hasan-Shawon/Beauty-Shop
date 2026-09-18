const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { seedIfEmpty, seedSettings } = require('./seed');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true, limit: '6mb' }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { maxAge: '30d', immutable: false }));

app.use('/api/auth', require('./routes/admin-auth'));
app.use('/api/admin/dashboard', require('./routes/admin-dashboard'));
app.use('/api/admin', require('./routes/admin-catalog'));
app.use('/api/admin', require('./routes/admin-commerce'));
app.use('/api/admin', require('./routes/admin-content'));
app.use('/api', require('./routes/public'));
app.use('/api', require('./routes/store'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// serve built client in production
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'Endpoint not found' }));

app.use((err, req, res, next) => {
  console.error('[error]', err);
  const status = err.status || 500;
  const msg = status === 500 ? 'Something went wrong. Please try again.' : err.message;
  if (res.headersSent) return next(err);
  res.status(status).json({ success: false, message: msg });
});

seedIfEmpty();

app.listen(PORT, () => {
  console.log(`Petal & Rose API running at http://localhost:${PORT}`);
});