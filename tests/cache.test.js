import { jest } from '@jest/globals';

describe('cache', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns null for a key that was never set', async () => {
    const { getCached } = await import('../src/services/cache.js');
    expect(getCached('missing')).toBeNull();
  });

  it('returns a cached value before it expires', async () => {
    const { getCached, setCached } = await import('../src/services/cache.js');
    setCached('key', { total_tasks: 5 });
    expect(getCached('key')).toEqual({ total_tasks: 5 });
  });

  it('expires a value after the configured TTL', async () => {
    process.env.ANALYTICS_CACHE_TTL_MS = '10';
    const { getCached, setCached } = await import('../src/services/cache.js');

    setCached('key', 'value');
    expect(getCached('key')).toBe('value');

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getCached('key')).toBeNull();

    delete process.env.ANALYTICS_CACHE_TTL_MS;
  });
});
