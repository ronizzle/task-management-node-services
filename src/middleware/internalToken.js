import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Guards Node endpoints meant to be called by Laravel itself (e.g.
 * notifications/send), not by end users. Mirrors Laravel's
 * EnsureInternalServiceToken — same shared secret, same header name.
 */
export function authenticateInternalToken(req, res, next) {
  const token = req.headers['x-internal-token'];

  if (!token || !timingSafeEqual(token, env.internalServiceToken)) {
    return res.status(401).json({ message: 'Invalid internal service token.' });
  }

  next();
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}
