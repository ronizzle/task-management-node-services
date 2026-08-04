import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('request logging', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs method, path, status, and null user id for an unauthenticated request', async () => {
    const app = createApp();

    await request(app).get('/health');

    const [line] = logSpy.mock.calls.find(([msg]) => msg.includes('"event":"api_request"'));
    const entry = JSON.parse(line);

    expect(entry).toMatchObject({
      event: 'api_request',
      method: 'GET',
      path: '/health',
      status: 200,
      user_id: null,
    });
    expect(typeof entry.duration_ms).toBe('number');
  });

  it('never logs the request body', async () => {
    const app = createApp();

    await request(app)
      .post('/api/notifications/send')
      .send({ user_id: 1, event_type: 'task_assigned', details: { secret: 'do-not-log-me' } });

    const logged = logSpy.mock.calls.map(([msg]) => msg).join('\n');

    expect(logged).not.toContain('do-not-log-me');
  });
});
