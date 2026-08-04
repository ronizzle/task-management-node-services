import { Router } from 'express';
import { authenticateJwt, requireLaravelUser, requireAdminOrManager } from '../middleware/auth.js';
import { laravelClientForUser } from '../services/laravelClient.js';
import { fetchAllTeamTasks, fetchTeamWithMembers } from '../services/taskData.js';
import { getCached, setCached } from '../services/cache.js';

const router = Router();

router.use(authenticateJwt, requireLaravelUser, requireAdminOrManager);

/**
 * @openapi
 * /api/analytics/task-summary:
 *   get:
 *     tags: [Analytics]
 *     summary: Task totals and average completion time for a team
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: team_id, in: query, required: true, schema: { type: integer } }
 *       - { name: date_from, in: query, schema: { type: string, format: date } }
 *       - { name: date_to, in: query, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Task summary (cached 1hr) }
 *       403: { description: Forbidden — team_member, or Manager outside their team }
 *       422: { description: team_id missing }
 */
router.get('/task-summary', async (req, res) => {
  const { team_id: teamId, date_from: dateFrom, date_to: dateTo } = req.query;

  if (!teamId) {
    return res.status(422).json({ message: 'team_id is required.' });
  }

  const cacheKey = `task-summary:${teamId}:${dateFrom ?? ''}:${dateTo ?? ''}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const client = laravelClientForUser(req.token);
    let tasks = await fetchAllTeamTasks(client, teamId);
    tasks = filterByDateRange(tasks, dateFrom, dateTo);

    const completed = tasks.filter((t) => t.status === 'completed');
    const pending = tasks.filter((t) => t.status === 'pending');

    const result = {
      team_id: Number(teamId),
      total_tasks: tasks.length,
      completed_tasks: completed.length,
      pending_tasks: pending.length,
      avg_completion_time: averageCompletionHours(completed),
    };

    setCached(cacheKey, result);
    res.json({ ...result, cached: false });
  } catch (err) {
    forwardError(err, res);
  }
});

/**
 * @openapi
 * /api/analytics/team-productivity:
 *   get:
 *     tags: [Analytics]
 *     summary: Per-member task counts by status for a team
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: team_id, in: query, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Per-member productivity breakdown (cached 1hr) }
 *       403: { description: Forbidden }
 *       422: { description: team_id missing }
 */
router.get('/team-productivity', async (req, res) => {
  const { team_id: teamId } = req.query;

  if (!teamId) {
    return res.status(422).json({ message: 'team_id is required.' });
  }

  const cacheKey = `team-productivity:${teamId}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const client = laravelClientForUser(req.token);
    const [tasks, team] = await Promise.all([
      fetchAllTeamTasks(client, teamId),
      fetchTeamWithMembers(client, teamId),
    ]);

    const byUser = new Map();
    for (const member of team.members ?? []) {
      byUser.set(member.id, {
        user_id: member.id,
        name: member.name,
        completed_tasks: 0,
        in_progress_tasks: 0,
        pending_tasks: 0,
      });
    }

    for (const task of tasks) {
      const entry = byUser.get(task.assigned_to);
      if (!entry) continue;

      if (task.status === 'completed') entry.completed_tasks += 1;
      else if (task.status === 'in_progress') entry.in_progress_tasks += 1;
      else if (task.status === 'pending') entry.pending_tasks += 1;
    }

    const result = { team_id: Number(teamId), members: [...byUser.values()] };

    setCached(cacheKey, result);
    res.json({ ...result, cached: false });
  } catch (err) {
    forwardError(err, res);
  }
});

/**
 * @openapi
 * /api/analytics/upcoming-deadlines:
 *   get:
 *     tags: [Analytics]
 *     summary: Non-terminal tasks due within a time window for a team
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: team_id, in: query, required: true, schema: { type: integer } }
 *       - { name: within_hours, in: query, schema: { type: integer, default: 168 } }
 *     responses:
 *       200: { description: Upcoming-deadline tasks (cached 1hr) }
 *       403: { description: Forbidden }
 *       422: { description: team_id missing }
 */
router.get('/upcoming-deadlines', async (req, res) => {
  const { team_id: teamId, within_hours: withinHoursRaw } = req.query;

  if (!teamId) {
    return res.status(422).json({ message: 'team_id is required.' });
  }

  const withinHours = withinHoursRaw ? Number(withinHoursRaw) : 24 * 7;
  const cacheKey = `upcoming-deadlines:${teamId}:${withinHours}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const client = laravelClientForUser(req.token);
    const tasks = await fetchAllTeamTasks(client, teamId);

    const now = Date.now();
    const horizon = now + withinHours * 60 * 60 * 1000;

    const upcoming = tasks.filter((task) => {
      if (!task.due_date) return false;
      if (['completed', 'cancelled'].includes(task.status)) return false;

      const due = new Date(task.due_date).getTime();
      return due >= now && due <= horizon;
    });

    const result = { team_id: Number(teamId), within_hours: withinHours, tasks: upcoming };

    setCached(cacheKey, result);
    res.json({ ...result, cached: false });
  } catch (err) {
    forwardError(err, res);
  }
});

function filterByDateRange(tasks, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return tasks;

  const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
  const to = dateTo ? new Date(dateTo).getTime() : Infinity;

  return tasks.filter((task) => {
    const createdAt = new Date(task.created_at).getTime();
    return createdAt >= from && createdAt <= to;
  });
}

function averageCompletionHours(completedTasks) {
  if (completedTasks.length === 0) return 0;

  const totalHours = completedTasks.reduce((sum, task) => {
    const created = new Date(task.created_at).getTime();
    const updated = new Date(task.updated_at).getTime();
    return sum + (updated - created) / (1000 * 60 * 60);
  }, 0);

  return Math.round((totalHours / completedTasks.length) * 100) / 100;
}

function forwardError(err, res) {
  if (err.response) {
    return res.status(err.response.status).json(err.response.data);
  }
  res.status(502).json({ message: 'Failed to reach Laravel API.' });
}

export default router;
