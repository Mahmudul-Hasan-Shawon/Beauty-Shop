import { requireRole } from '../auth.js';
import { toNum, nowISO } from '../utils.js';

export function mount(router) {
  router.get('/api/admin/dashboard/overview', async (r, app) => {
    await requireRole(r, app, []);
    const today = nowISO().slice(0, 10);

    const totalSales = (await app.db.get(`SELECT COALESCE(SUM(total),0) s FROM orders WHERE status NOT IN ('cancelled','returned')`)).s;
    const orders = (await app.db.get(`SELECT COUNT(*) c FROM orders WHERE status NOT IN ('cancelled','returned')`)).c;
    const pendingOrders = (await app.db.get("SELECT COUNT(*) c FROM orders WHERE status IN ('pending','confirmed','processing')")).c;
    const customers = (await app.db.get('SELECT COUNT(*) c FROM users')).c;
    const products = (await app.db.get('SELECT COUNT(*) c FROM products')).c;
    const reviews = (await app.db.get("SELECT COUNT(*) c FROM reviews WHERE status='pending'")).c;
    const todaySales = (await app.db.get(`SELECT COALESCE(SUM(total),0) s FROM orders WHERE date(created_at)=? AND status NOT IN ('cancelled','returned')`, today)).s;
    let lowStockThreshold = 10;
    try {
      const notif = await app.db.get("SELECT value FROM settings WHERE [key]='notifications'");
      lowStockThreshold = toNum(JSON.parse(notif?.value || '{}')?.lowStockThreshold, 10);
    } catch {}
    const lowStock = (await app.db.get('SELECT COUNT(*) c FROM products WHERE stock <= ?', lowStockThreshold)).c;

    const week = await app.db.all(`
      SELECT date(created_at) AS day, COALESCE(SUM(total),0) AS sales, COUNT(*) AS orders
      FROM orders WHERE date(created_at) >= date('now','-13 days') AND status NOT IN ('cancelled','returned')
      GROUP BY day ORDER BY day LIMIT 14
    `);
    const month = await app.db.all(`SELECT strftime('%Y-%m-%d', created_at) day, COALESCE(SUM(total),0) sales FROM orders WHERE created_at >= datetime('now','-30 days') AND status NOT IN ('cancelled','returned') GROUP BY day ORDER BY day`);

    return {
      success: true,
      data: {
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
        lowStockItems: await app.db.all('SELECT id, title, sku, stock, thumbnail FROM products WHERE stock <= ? ORDER BY stock LIMIT 8', lowStockThreshold),
        recentOrders: await app.db.all('SELECT id, order_no AS orderNo, customer_name AS customer, phone, total, status, created_at AS date FROM orders ORDER BY id DESC LIMIT 8'),
        statusCounts: await app.db.all('SELECT status, COUNT(*) c FROM orders GROUP BY status')
      }
    };
  });

  router.get('/api/admin/dashboard/sales/:range', async (r, app) => {
    await requireRole(r, app, []);
    const range = r.params.range;
    const map = {
      daily: `strftime('%Y-%m-%d', created_at)`,
      weekly: `strftime('%Y-W%W', created_at)`,
      monthly: `strftime('%Y-%m', created_at)`,
      yearly: `strftime('%Y', created_at)`
    };
    const expr = map[range] || map.daily;
    const rows = await app.db.all(`SELECT ${expr} AS label, COALESCE(SUM(total),0) AS sales, COUNT(*) AS orders
      FROM orders WHERE status NOT IN ('cancelled','returned')
      ${range === 'daily' ? "AND created_at >= datetime('now','-30 days')" : range === 'weekly' ? "AND created_at >= datetime('now','-180 days')" : range === 'monthly' ? "AND created_at >= datetime('now','-12 months')" : ''}
      GROUP BY label ORDER BY label`);
    return { success: true, data: rows };
  });
}