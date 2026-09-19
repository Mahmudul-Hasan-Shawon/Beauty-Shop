import { Router, HttpError, makeDb, readBody } from './router.js';
import { mount as mountPublic } from './routes/public.js';
import { mount as mountStore } from './routes/store.js';
import { mount as mountAdminAuth } from './routes/admin-auth.js';
import { mount as mountAdminCatalog } from './routes/admin-catalog.js';
import { mount as mountAdminCommerce } from './routes/admin-commerce.js';
import { mount as mountAdminContent } from './routes/admin-content.js';
import { mount as mountAdminDashboard } from './routes/admin-dashboard.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Customer',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': 'Content-Type'
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS, ...headers }
  });
}

async function serveAsset(env, request) {
  if (env.ASSETS) {
    return env.ASSETS.fetch(request);
  }
  return new Response('Not found', { status: 404 });
}

const router = new Router();
mountAdminAuth(router);
mountAdminDashboard(router);
mountAdminCatalog(router);
mountAdminCommerce(router);
mountAdminContent(router);
mountPublic(router);
mountStore(router);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = CORS_HEADERS;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const app = {
      env,
      db: makeDb(env),
      secret: env.JWT_SECRET || 'petal-rose-dev-secret-change-me',
      publicBase: url.origin
    };

    try {
      for (const route of router.routes) {
        if (route.method !== request.method) continue;
        const m = url.pathname.match(route.regex);
        if (!m) continue;
        const params = {};
        route.names.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1] || ''); });
        const body = ['POST', 'PUT', 'PATCH'].includes(request.method) ? await readBody(request, env) : null;
        const req = {
          method: request.method,
          pathname: url.pathname,
          search: url.search,
          query: Object.fromEntries(url.searchParams.entries()),
          params,
          body,
          headers: {
            Authorization: request.headers.get('authorization') || '',
            'Content-Type': request.headers.get('content-type') || ''
          },
          customerKey: String(request.headers.get('x-customer') || 'guest').slice(0, 64),
          raw: request
        };
        const result = await route.handler(req, app);
        if (result instanceof Response) return result;
        if (result && typeof result === 'object' && '__status' in result) {
          return json(result, result.__status);
        }
        return json(result);
      }
      return await serveAsset(env, request);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ success: false, message: err.message, errors: err.errors }, err.status);
      }
      console.error('[api error]', err && err.stack ? err.stack : err);
      return json({ success: false, message: 'Something went wrong. Please try again.' }, 500);
    }
  }
};