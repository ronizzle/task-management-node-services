import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { laravelClientForUser } from '../services/laravelClient.js';

/**
 * Verifies the JWT Laravel issued (same JWT_SECRET, HS256) and attaches the
 * raw token so route handlers can forward it to Laravel on the user's
 * behalf. Node never trusts a role claim from the token itself (Laravel's
 * JWTSubject issues no custom claims) — anything that needs the caller's
 * role calls back into Laravel via requireLaravelUser below.
 */
export function authenticateJwt(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    req.token = token;
    req.jwtPayload = payload;
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }
}

/**
 * Fetches the caller's Laravel user record (role, is_active) so Node can
 * enforce role gates locally before hitting Laravel again for data — e.g.
 * analytics/export are Admin/Manager only, which the underlying task-list
 * endpoints Node calls don't enforce on their own (team members are valid
 * team members too).
 */
export async function requireLaravelUser(req, res, next) {
  try {
    const client = laravelClientForUser(req.token);
    const { data } = await client.get(`/users/${req.userId}`);
    req.currentUser = data;
    next();
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(502).json({ message: 'Failed to reach Laravel API.' });
  }
}

export function requireAdminOrManager(req, res, next) {
  if (!req.currentUser || !['admin', 'manager'].includes(req.currentUser.role)) {
    return res.status(403).json({ message: 'You do not have permission to perform this action.' });
  }
  next();
}
