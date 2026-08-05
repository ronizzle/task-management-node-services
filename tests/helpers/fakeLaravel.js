import http from 'node:http';

const PORT = Number(process.env.FAKE_LARAVEL_PORT || 9999);

/**
 * Minimal fake Laravel API for tests that exercise Node routes/jobs which
 * call back into Laravel (analytics, export, cron jobs). Listens on the
 * same host:port as LARAVEL_API_URL in tests/setupEnv.js — derived from
 * FAKE_LARAVEL_PORT (per-Jest-worker, see setupEnv.js) so concurrent test
 * files in different workers never race for the same port.
 *
 * `routes` is an array of { method, test: (pathname) => bool, handler }.
 * `handler({ pathname, query, headers, body })` returns `{ status, body }`.
 */
export function startFakeLaravel(routes) {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const route = routes.find((r) => r.method === req.method && r.test(url.pathname));

      if (!route) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: `fake laravel: no route for ${req.method} ${url.pathname}` }));
        return;
      }

      const result = route.handler({
        pathname: url.pathname,
        query: url.searchParams,
        headers: req.headers,
        body: raw ? JSON.parse(raw) : undefined,
      });

      res.writeHead(result.status ?? 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.body ?? {}));
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

export function stopFakeLaravel(server) {
  return new Promise((resolve) => server.close(resolve));
}

/** Wraps a paginated-list shape matching Laravel's default paginator. */
export function page(data) {
  return { data, current_page: 1, last_page: 1 };
}
