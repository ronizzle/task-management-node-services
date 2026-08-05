import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '#src/app.js';
import { startFakeLaravel, stopFakeLaravel, page } from '#tests/helpers/fakeLaravel.js';

const tasks = [
  { id: 1, title: 'Setup database', status: 'completed', priority: 'high', assigned_to: 2, due_date: null, created_at: '2026-01-01T00:00:00Z' },
  { id: 2, title: 'Write API docs', status: 'pending', priority: 'medium', assigned_to: 3, due_date: null, created_at: '2026-01-02T00:00:00Z' },
];

function laravelRoutes() {
  return [
    {
      method: 'GET',
      test: (p) => p === '/api/teams/1/tasks',
      handler: ({ query }) => {
        const status = query.get('status');
        const filtered = status ? tasks.filter((t) => t.status === status) : tasks;
        return { status: 200, body: page(filtered) };
      },
    },
  ];
}

function token() {
  return jwt.sign({ sub: '1' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
}

describe('POST /api/export/tasks', () => {
  let server;
  let app;

  beforeAll(async () => {
    server = await startFakeLaravel(laravelRoutes());
    app = createApp();
  });

  afterAll(() => stopFakeLaravel(server));

  it('returns 422 when team_id is missing', async () => {
    const res = await request(app)
      .post('/api/export/tasks')
      .set('Authorization', `Bearer ${token()}`)
      .send({ format: 'csv' });

    expect(res.status).toBe(422);
  });

  it('returns 422 for an unsupported format', async () => {
    const res = await request(app)
      .post('/api/export/tasks')
      .set('Authorization', `Bearer ${token()}`)
      .send({ team_id: 1, format: 'pdf' });

    expect(res.status).toBe(422);
  });

  it('streams a CSV with the expected header row and rows', async () => {
    const res = await request(app)
      .post('/api/export/tasks')
      .set('Authorization', `Bearer ${token()}`)
      .send({ team_id: 1, format: 'csv' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('tasks-team-1.csv');
    const lines = res.text.trim().split('\n');
    expect(lines[0]).toBe('id,title,status,priority,assigned_to,due_date,created_at');
    expect(lines).toHaveLength(3); // header + 2 tasks
  });

  it('returns JSON rows scoped to the requested filters', async () => {
    const res = await request(app)
      .post('/api/export/tasks')
      .set('Authorization', `Bearer ${token()}`)
      .send({ team_id: 1, format: 'json', filters: { status: 'completed' } });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 1, title: 'Setup database' });
  });

  it('streams an xlsx workbook', async () => {
    const res = await request(app)
      .post('/api/export/tasks')
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .set('Authorization', `Bearer ${token()}`)
      .send({ team_id: 1, format: 'xlsx' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('returns 401 without a JWT', async () => {
    const res = await request(app).post('/api/export/tasks').send({ team_id: 1, format: 'csv' });
    expect(res.status).toBe(401);
  });
});
