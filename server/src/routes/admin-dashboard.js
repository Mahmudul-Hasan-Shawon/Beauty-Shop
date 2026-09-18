const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { ok, toNum, nowISO } = require('../utils');

const router = express.Router();
router.use(requireAuth);

router.get('/overview', (req, res) => {
  const today = nowISO().slice(0, 10);

  const totalSales = db.prepare(`SELECT COALESCE(SUM(total),0) s FROM orders WHERE status NOT IN ('cancelled','returned')`).get().s;
  const orders = db.prepare(`SELECT COUNT(*) c FROM orders WHERE status NOT IN ('cancelled','returned')`).get().c;
  const pendingOrders = db.prepare("SELECT COUNT(*) c FROM orders WHERE status IN ('pending','confirmed','processing')").get().c;
  const customers = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const products = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  const reviews = db.prepare("SELECT COUNT(*) c FROM reviews WHERE status='pending'").get().c;
  const todaySales = db.prepare(`SELECT COALESCE(SUM(total),0) s FROM orders WHERE date(created_at)=? AND status NOT IN ('cancelled','returned')`).get(today).s;
  const lowStockThreshold = toNum(JSON.parse(db.prepare("SELECT value FROM settings WHERE [key]='notifications'").get().value)?.lowStockThreshold, 10);
  const lowStock = db.prepare('SELECT COUNT(*) c FROM products WHERE stock <= ?').get(lowStockThreshold).c;

  const week = db.prepare(`
    SELECT date(created_at) AS day, COALESCE(SUM(total),0) AS sales, COUNT(*) AS orders
    FROM orders WHERE date(created_at) >= date('now','-13 days') AND status NOT IN ('cancelled','returned')
    GROUP BY day ORDER BY day LIMIT 14
  `).all();
  const month = db.prepare(`SELECT strftime('%Y-%m-%d', created_at) day, COALESCE(SUM(total),0) sales FROM orders WHERE created_at >= datetime('now','-30 days') AND status NOT IN ('cancelled','returned') GROUP BY day ORDER BY day`).all();

  ok(res, {
    cards: {
      totalSales: Math.round(totalSales),
      orders,
      customers,
      products,
      pendingOrders,
      lowStock,
      todaySales: Math.round(todaySales),
      pendingReviews: reviews
    },
    week,
    month,
    lowStockItems: db.prepare('SELECT id, title, sku, stock, thumbnail FROM products WHERE stock <= ? ORDER BY stock LIMIT 8').all(lowStockThreshold),
    recentOrders: db.prepare('SELECT id, order_no AS orderNo, customer_name AS customer, phone, total, status, created_at AS date FROM orders ORDER BY id DESC LIMIT 8').all(),
    statusCounts: db.prepare('SELECT status, COUNT(*) c FROM orders GROUP BY status').all()
  });
});

router.get('/sales/:range', (req, res) => {
  const range = req.params.range;
  const map = {
    daily: `strftime('%Y-%m-%d', created_at)`,
    weekly: `strftime('%Y-W%W', created_at)`,
    monthly: `strftime('%Y-%m', created_at)`,
    yearly: `strftime('%Y', created_at)`
  };
  const expr = map[range] || map.daily;
  const rows = db.prepare(`SELECT ${expr} AS label, COALESCE(SUM(total),0) AS sales, COUNT(*) AS orders
    FROM orders WHERE status NOT IN ('cancelled','returned')
    ${range === 'daily' ? "AND created_at >= datetime('now','-30 days')" : range === 'weekly' ? "AND created_at >= datetime('now','-180 days')" : range === 'monthly' ? "AND created_at >= datetime('now','-12 months')" : ''}
    GROUP BY label ORDER BY label`).all();
  ok(res, rows);
});

module.exports = router;