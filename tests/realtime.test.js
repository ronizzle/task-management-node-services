import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;

describe('POST /api/realtime/broadcast', () => {
  it('requires the internal service token', async () => {
    const res = await request(app)
      .post('/api/realtime/broadcast')
      .send({ room: 'task:1', event: 'task_updated', payload: {} });

    expect(res.status).toBe(401);
  });

  it('rejects a request missing room or event', async () => {
    const res = await request(app)
      .post('/api/realtime/broadcast')
      .set('X-Internal-Token', INTERNAL_TOKEN)
      .send({ event: 'task_updated' });

    expect(res.status).toBe(422);
  });

  it('accepts a valid broadcast request (no socket server attached in this test)', async () => {
    const res = await request(app)
      .post('/api/realtime/broadcast')
      .set('X-Internal-Token', INTERNAL_TOKEN)
      .send({ room: 'task:1', event: 'task_updated', payload: { status: 'in_progress' } });

    expect(res.status).toBe(202);
  });
});
