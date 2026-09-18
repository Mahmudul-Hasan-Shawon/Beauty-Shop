const BASE = import.meta.env.VITE_API_BASE || '';

function customerKey() {
  let k = localStorage.getItem('pr-customer');
  if (!k) {
    k = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('pr-customer', k);
  }
  return k;
}

async function request(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  headers['X-Customer'] = customerKey();
  const token = localStorage.getItem('pr-admin-token');
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(BASE + path, { ...opts, headers });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    if (res.status === 401 && /^\/api\/admin/.test(path)) {
      localStorage.removeItem('pr-admin-token');
    }
    throw err;
  }
  return data;
}

const api = {
  get: (path, params) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString() : '';
    return request(path + qs);
  },
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' })
};

export default api;
export { customerKey };