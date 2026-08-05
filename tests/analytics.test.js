import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '#src/app.js';
import { clearCache } from '#src/services/cache.js';
import { startFakeLaravel, stopFakeLaravel, page } from '#tests/helpers/fakeLaravel.js';

const ADMIN_ID = '1';
const MEMBER_ID = '5';
const BOB_ID = 2;
const CAROL_ID = 3;

const now = Date.now();
const iso = (msOffset) => new Date(now + msOffset).toISOString();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const tasks = [
  // completed 5h ago -> 3h ago: 2h completion time, assigned to Bob
  { id: 1, status: 'completed', priority: 'high', assigned_to: BOB_ID, due_date: null, created_at: iso(-5 * HOUR), updated_at: iso(-3 * HOUR) },
  // pending, due in 3 days, assigned to Bob
  { id: 2, status: 'pending', priority: 'medium', assigned_to: BOB_ID, due_date: iso(3 * DAY), created_at: iso(0), updated_at: iso(0) },
  // in_progress, due in 40 days (outside default 7-day window), assigned to Carol
  { id: 3, status: 'in_progress', priority: 'low', assigned_to: CAROL_ID, due_date: iso(40 * DAY), created_at: iso(0), updated_at: iso(0) },
];

function tokenFor(sub) {
  return jwt.sign({ sub }, process.env.JWT_SECRET, { algorithm: 'HS256' });
}

function laravelRoutes() {
  return [
    {
      method: 'GET',
      test: (p) => p === `/api/users/${ADMIN_ID}`,
      handler: () => ({ status: 200, body: { id: Number(ADMIN_ID), role: 'admin', is_active: true } }),
    },
    {
      method: 'GET',
      test: (p) => p === `/api/users/${MEMBER_ID}`,
      handler: () => ({ status: 200, body: { id: Number(MEMBER_ID), role: 'team_member', is_active: true } }),
    },
    {
      method: 'GET',
      test: (p) => p === '/api/teams/1/tasks',
      handler: ({ query }) => {
        const status = query.get('status');
        const filtered = status ? tasks.filter((t) => t.status === status) : tasks;
        return { status: 200, body: page(filtered) };
      },
    },
    {
      method: 'GET',
      test: (p) => p === '/api/teams/1',
      handler: () => ({
        status: 200,
        body: {
          id: 1,
          name: 'Engineering',
          members: [
            { id: BOB_ID, name: 'Bob' },
            { id: CAROL_ID, name: 'Carol' },
          ],
        },
      }),
    },
  ];
}

describe('analytics routes', () => {
  let server;
  let app;

  beforeAll(async () => {
    server = await startFakeLaravel(laravelRoutes());
    app = createApp();
  });

  afterAll(() => stopFakeLaravel(server));

  beforeEach(() => clearCache());

  describe('GET /api/analytics/task-summary', () => {
    it('returns 422 when team_id is missing', async () => {
      const res = await request(app)
        .get('/api/analytics/task-summary')
        .set('Authorization', `Bearer ${tokenFor(ADMIN_ID)}`);

      expect(res.status).toBe(422);
    });

    it('returns 403 for a team_member', async () => {
      const res = await request(app)
        .get('/api/analytics/task-summary?team_id=1')
        .set('Authorization', `Bearer ${tokenFor(MEMBER_ID)}`);

      expect(res.status).toBe(403);
    });

    it('computes totals and average completion time for an admin', async () => {
      const res = await request(app)
        .get('/api/analytics/task-summary?team_id=1')
        .set('Authorization', `Bearer ${tokenFor(ADMIN_ID)}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        total_tasks: 3,
        completed_tasks: 1,
        pending_tasks: 1,
        avg_completion_time: 2,
        cached: false,
      });
    });

    it('serves the second identical request from cache', async () => {
      await request(app).get('/api/analytics/task-summary?team_id=1').set('Authorization', `Bearer ${tokenFor(ADMIN_ID)}`);
      const res = await request(app).get('/api/analytics/task-summary?team_id=1').set('Authorization', `Bearer ${tokenFor(ADMIN_ID)}`);

      expect(res.body.cached).toBe(true);
      expect(res.body.total_tasks).toBe(3);
    });
  });

  describe('GET /api/analytics/team-productivity', () => {
    it('breaks down task counts per member', async () => {
      const res = await request(app)
        .get('/api/analytics/team-productivity?team_id=1')
        .set('Authorization', `Bearer ${tokenFor(ADMIN_ID)}`);

      expect(res.status).toBe(200);
      const bob = res.body.members.find((m) => m.user_id === BOB_ID);
      const carol = res.body.members.find((m) => m.user_id === CAROL_ID);

      expect(bob).toMatchObject({
        completed_tasks: 1,
        pending_tasks: 1,
        in_progress_tasks: 0,
        completion_rate: 0.5,
        avg_completion_time: 2,
      });
      expect(carol).toMatchObject({
        completed_tasks: 0,
        pending_tasks: 0,
        in_progress_tasks: 1,
        completion_rate: 0,
        avg_completion_time: 0,
      });
    });
  });

  describe('GET /api/analytics/upcoming-deadlines', () => {
    it('only includes non-terminal tasks due within the default 7-day window, grouped by assignee', async () => {
      const res = await request(app)
        .get('/api/analytics/upcoming-deadlines?team_id=1')
        .set('Authorization', `Bearer ${tokenFor(ADMIN_ID)}`);

      expect(res.status).toBe(200);
      expect(res.body.members).toEqual([
        { user_id: BOB_ID, name: 'Bob', tasks: expect.arrayContaining([expect.objectContaining({ id: 2 })]) },
      ]);
      expect(res.body.members[0].tasks).toHaveLength(1);
    });

    it('respects a wider within_hours window', async () => {
      const res = await request(app)
        .get(`/api/analytics/upcoming-deadlines?team_id=1&within_hours=${41 * 24}`)
        .set('Authorization', `Bearer ${tokenFor(ADMIN_ID)}`);

      const idsByMember = res.body.members
        .flatMap((m) => m.tasks)
        .map((t) => t.id)
        .sort();
      expect(idsByMember).toEqual([2, 3]);
    });
  });
});
