const API_ORIGIN = 'https://petalsrose.mhshan177.workers.dev';

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) {
    const target = new URL(url.pathname + url.search, API_ORIGIN);
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.set('x-forwarded-host', url.host);

    const init = { method: request.method, headers };
    if (!['GET', 'HEAD'].includes(request.method)) {
      init.body = request.body;
    }

    return fetch(target, init);
  }

  return next();
}