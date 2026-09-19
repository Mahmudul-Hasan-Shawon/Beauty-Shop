const API_ORIGIN = 'https://petalsrose.mhshan177.workers.dev';

export async function onRequest(context) {
  const { request, next, env } = context;
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

  const response = await next();
  if (response.status === 404) {
    const index = await env.ASSETS.fetch('http://localhost/index.html');
    return new Response(index.body, {
      status: 200,
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
  }
  return response;
}