import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('app', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/analytics/task-summary requires authentication', async () => {
    const res = await request(app).get('/api/analytics/task-summary?team_id=1');
    expect(res.status).toBe(401);
  });

  it('POST /api/export/tasks requires authentication', async () => {
    const res = await request(app).post('/api/export/tasks').send({ team_id: 1, format: 'csv' });
    expect(res.status).toBe(401);
  });

  it('POST /api/notifications/send requires the internal service token', async () => {
    const res = await request(app)
      .post('/api/notifications/send')
      .send({ user_id: 1, event_type: 'task_assigned', details: {} });
    expect(res.status).toBe(401);
  });

  it('unknown routes return 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
