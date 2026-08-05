import request from 'supertest';
import { createApp } from '#src/app.js';
import { startFakeLaravel, stopFakeLaravel } from '#tests/helpers/fakeLaravel.js';

function laravelRoutes() {
  return [
    {
      method: 'GET',
      test: (p) => p === '/api/users/2',
      handler: () => ({ status: 200, body: { id: 2, email: 'member@test.com', is_active: true } }),
    },
  ];
}

describe('POST /api/notifications/send', () => {
  let server;
  let app;

  beforeAll(async () => {
    server = await startFakeLaravel(laravelRoutes());
    app = createApp();
  });

  afterAll(() => stopFakeLaravel(server));

  it('rejects a request with the wrong internal token', async () => {
    const res = await request(app)
      .post('/api/notifications/send')
      .set('X-Internal-Token', 'wrong')
      .send({ user_id: 2, event_type: 'task_assigned' });

    expect(res.status).toBe(401);
  });

  it('returns 422 when user_id or event_type is missing', async () => {
    const res = await request(app)
      .post('/api/notifications/send')
      .set('X-Internal-Token', process.env.INTERNAL_SERVICE_TOKEN)
      .send({ event_type: 'task_assigned' });

    expect(res.status).toBe(422);
  });

  it('accepts a valid request immediately (202) and processes it in the background', async () => {
    const res = await request(app)
      .post('/api/notifications/send')
      .set('X-Internal-Token', process.env.INTERNAL_SERVICE_TOKEN)
      .send({ task_id: 1, user_id: 2, event_type: 'task_assigned', details: { title: 'Setup database' } });

    expect(res.status).toBe(202);

    // The send route responds immediately and processes in the background
    // (see src/routes/notifications.js) — give that in-flight promise a
    // moment to settle before afterAll tears down the fake Laravel server,
    // otherwise its rejection handler logs after the test/server are gone.
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
});
