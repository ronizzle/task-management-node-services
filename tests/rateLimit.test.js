import request from 'supertest';
import { createApp } from '../src/app.js';

describe('rate limiting', () => {
  it('allows up to 60 requests per minute then returns 429', async () => {
    const app = createApp();

    for (let i = 0; i < 60; i++) {
      const res = await request(app)
        .post('/api/notifications/send')
        .send({ user_id: 1, event_type: 'task_assigned', details: {} });
      expect(res.status).not.toBe(429);
    }

    const blocked = await request(app)
      .post('/api/notifications/send')
      .send({ user_id: 1, event_type: 'task_assigned', details: {} });

    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/too many requests/i);
  });

  it('sends RateLimit-* headers on a limited response', async () => {
    const app = createApp();

    const res = await request(app).get('/api/analytics/task-summary?team_id=1');

    expect(res.headers['ratelimit-limit']).toBe('60');
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });

  it('shares the request budget across all rate-limited routes', async () => {
    const app = createApp();

    for (let i = 0; i < 30; i++) {
      await request(app).get('/api/analytics/task-summary?team_id=1');
    }
    for (let i = 0; i < 30; i++) {
      await request(app).post('/api/export/tasks').send({ team_id: 1, format: 'csv' });
    }

    const blocked = await request(app).post('/api/notifications/send').send({});
    expect(blocked.status).toBe(429);
  });

  it('does not rate limit unrelated routes like /health', async () => {
    const app = createApp();

    for (let i = 0; i < 65; i++) {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    }
  });
});
