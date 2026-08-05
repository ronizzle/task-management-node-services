import { runDailyDigest } from '#src/jobs/dailyDigest.js';
import { runDeadlineReminder } from '#src/jobs/deadlineReminder.js';
import { runTaskCleanup } from '#src/jobs/taskCleanup.js';
import { startFakeLaravel, stopFakeLaravel, page } from '#tests/helpers/fakeLaravel.js';

const now = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const iso = (msOffset) => new Date(now + msOffset).toISOString();

// A: incomplete, no due date -> counts toward daily digest only
// B: incomplete, no due date -> counts toward daily digest only
// D: incomplete, due in 6h -> counts toward digest AND deadline reminder
// E: incomplete, due in 5 days -> counts toward digest only (outside 24h reminder window)
// F: cancelled 40 days ago, not archived -> stale, should be cleaned up
// G: cancelled 5 days ago -> not old enough
// H: cancelled 40 days ago but already archived -> excluded
const tasks = [
  { id: 'A', status: 'pending', assigned_to: 2, due_date: null, updated_at: iso(0), created_at: iso(-HOUR) },
  { id: 'B', status: 'in_progress', assigned_to: 3, due_date: null, updated_at: iso(0), created_at: iso(-HOUR) },
  { id: 'D', status: 'pending', assigned_to: 2, due_date: iso(6 * HOUR), updated_at: iso(0), created_at: iso(-HOUR) },
  { id: 'E', status: 'pending', assigned_to: 3, due_date: iso(5 * DAY), updated_at: iso(0), created_at: iso(-HOUR) },
  { id: 'F', status: 'cancelled', assigned_to: 2, due_date: null, updated_at: iso(-40 * DAY), archived_at: null },
  { id: 'G', status: 'cancelled', assigned_to: 2, due_date: null, updated_at: iso(-5 * DAY), archived_at: null },
  { id: 'H', status: 'cancelled', assigned_to: 2, due_date: null, updated_at: iso(-40 * DAY), archived_at: iso(-39 * DAY) },
];

const archiveCalls = [];

function laravelRoutes() {
  return [
    { method: 'GET', test: (p) => p === '/api/teams', handler: () => ({ status: 200, body: page([{ id: 1, name: 'Engineering' }]) }) },
    { method: 'GET', test: (p) => p === '/api/teams/1/tasks', handler: () => ({ status: 200, body: page(tasks) }) },
    {
      method: 'GET',
      test: (p) => /^\/api\/users\/\d+$/.test(p),
      handler: ({ pathname }) => ({
        status: 200,
        body: { id: Number(pathname.split('/').pop()), email: `user${pathname.split('/').pop()}@test.com`, is_active: true },
      }),
    },
    {
      method: 'DELETE',
      test: (p) => /^\/api\/tasks\/\w+\/archive$/.test(p),
      handler: ({ pathname }) => {
        archiveCalls.push(pathname);
        return { status: 200, body: {} };
      },
    },
  ];
}

describe('cron jobs', () => {
  let server;

  beforeAll(async () => {
    server = await startFakeLaravel(laravelRoutes());
  });

  afterAll(() => stopFakeLaravel(server));

  beforeEach(() => {
    archiveCalls.length = 0;
  });

  it('daily digest groups incomplete tasks by assignee and emails one summary per user', async () => {
    const result = await runDailyDigest();
    // Users 2 and 3 each have >=1 incomplete task -> one digest per user, none fail.
    expect(result).toEqual({ sent: 2, failed: 0 });
  });

  it('deadline reminder only fires for non-terminal tasks due within 24h', async () => {
    const result = await runDeadlineReminder();
    // Only task D is due within 24h with an assignee.
    expect(result).toEqual({ sent: 1, failed: 0 });
  });

  it('task cleanup archives only cancelled tasks older than 30 days that are not already archived', async () => {
    const result = await runTaskCleanup();
    expect(result).toEqual({ archived: 1, failed: 0 });
    expect(archiveCalls).toEqual(['/api/tasks/F/archive']);
  });
});
