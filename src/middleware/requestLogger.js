/**
 * Logs one line per request/response. Registered before auth so it still
 * fires on 401s, but reads req.userId on the 'finish' event (after auth
 * middleware has run) so authenticated requests get a user id. Never logs
 * body/headers, so it can't leak passwords or bearer tokens.
 */
export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

    console.log(
      JSON.stringify({
        event: 'api_request',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: Math.round(durationMs * 100) / 100,
        user_id: req.userId ?? null,
        ip: req.ip,
      })
    );
  });

  next();
}
