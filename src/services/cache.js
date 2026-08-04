import { env } from '../config/env.js';

/**
 * Simple in-memory cache with a timestamp per entry (no Redis — avoids an
 * extra paid Render service for this scope). Not shared across processes;
 * fine for a single Node instance.
 */
const store = new Map();

export function getCached(key) {
  const entry = store.get(key);

  if (!entry) return null;

  if (Date.now() - entry.cachedAt > env.analyticsCacheTtlMs) {
    store.delete(key);
    return null;
  }

  return entry.value;
}

export function setCached(key, value) {
  store.set(key, { value, cachedAt: Date.now() });
}

export function clearCache() {
  store.clear();
}
