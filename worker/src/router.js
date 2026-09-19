function normParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  if (params.length === 1 && params[0] && typeof params[0] === 'object') return params[0];
  return params;
}

function bindSql(sql, vals) {
  if (vals && typeof vals === 'object' && !Array.isArray(vals)) {
    const names = [];
    const text = String(sql).replace(/@([a-zA-Z_]\w*)/g, (m, name) => {
      names.push(name);
      return '?';
    });
    return { text, values: names.map((n) => (n in vals ? vals[n] : null)) };
  }
  return { text: String(sql), values: vals || [] };
}

export function makeDb(env) {
  return {
    async all(sql, ...params) {
      const { text, values } = bindSql(sql, normParams(params));
      const stmt = env.DB.prepare(text).bind(...values);
      const res = await stmt.all();
      return res.results || [];
    },
    async get(sql, ...params) {
      const { text, values } = bindSql(sql, normParams(params));
      const stmt = env.DB.prepare(text).bind(...values);
      const row = await stmt.first();
      return row ?? null;
    },
    async run(sql, ...params) {
      const { text, values } = bindSql(sql, normParams(params));
      const stmt = env.DB.prepare(text).bind(...values);
      const res = await stmt.run();
      return { changes: res.meta?.changes ?? 0, lastInsertRowid: Number(res.meta?.last_insert_rowid ?? 0) };
    }
  };
}

export class Router {
  constructor() {
    this.routes = [];
  }

  _add(method, pattern, handler) {
    const names = [];
    const regexStr = pattern
      .split('/')
      .map((seg) => {
        if (seg.startsWith(':')) {
          names.push(seg.slice(1));
          return '([^/]+)';
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    this.routes.push({
      method,
      regex: new RegExp(`^${regexStr}$`),
      names,
      handler
    });
  }

  get(p, h) { this._add('GET', p, h); }
  post(p, h) { this._add('POST', p, h); }
  put(p, h) { this._add('PUT', p, h); }
  patch(p, h) { this._add('PATCH', p, h); }
  delete(p, h) { this._add('DELETE', p, h); }
}

export class HttpError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export async function readBody(request, env) {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData();
    return form;
  }
  if (ct.includes('application/json')) {
    try { return await request.json(); } catch { return {}; }
  }
  return {};
}