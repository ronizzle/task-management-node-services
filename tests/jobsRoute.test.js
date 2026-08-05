import request from 'supertest';
import { createApp } from '#src/app.js';
import { startFakeLaravel, stopFakeLaravel, page } from '#tests/helpers/fakeLaravel.js';

function laravelRoutes() {
  return [
    { method: 'GET', test: (p) => p === '/api/teams', handler: () => ({ status: 200, body: page([{ id: 1, name: 'Engineering' }]) }) },
    {
      method: 'GET',
      test: (p) => p === '/api/teams/1/tasks',
      handler: () => ({
        status: 200,
        body: page([{ id: 'A', status: 'pending', assigned_to: 2, due_date: null }]),
      }),
    },
    {
      method: 'GET',
      test: (p) => /^\/api\/users\/\d+$/.test(p),
      handler: ({ pathname }) => ({
        status: 200,
        body: { id: Number(pathname.split('/').pop()), email: `user${pathname.split('/').pop()}@test.com`, is_active: true },
      }),
    },
  ];
}

describe('POST /internal/jobs/daily-digest', () => {
  let server;
  let app;

  beforeAll(async () => {
    server = await startFakeLaravel(laravelRoutes());
    app = createApp();
  });

  afterAll(() => stopFakeLaravel(server));

  it('rejects a request with the wrong internal token', async () => {
    const res = await request(app).post('/internal/jobs/daily-digest').set('X-Internal-Token', 'wrong');

    expect(res.status).toBe(401);
  });

  it('runs the digest synchronously and reports sent/failed counts', async () => {
    const res = await request(app)
      .post('/internal/jobs/daily-digest')
      .set('X-Internal-Token', process.env.INTERNAL_SERVICE_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sent: 1, failed: 0 });
  });
});
