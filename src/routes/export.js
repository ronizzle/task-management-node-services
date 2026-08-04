import { Router } from 'express';
import { format as formatCsv } from 'fast-csv';
import ExcelJS from 'exceljs';
import { authenticateJwt } from '../middleware/auth.js';
import { laravelClientForUser } from '../services/laravelClient.js';
import { fetchAllTeamTasks } from '../services/taskData.js';

const router = Router();

const EXPORT_COLUMNS = ['id', 'title', 'status', 'priority', 'assigned_to', 'due_date', 'created_at'];

/**
 * @openapi
 * /api/export/tasks:
 *   post:
 *     tags: [Export]
 *     summary: Export a team's tasks as a file stream
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [team_id]
 *             properties:
 *               team_id: { type: integer }
 *               format: { type: string, enum: [csv, json, xlsx], default: csv }
 *               filters:
 *                 type: object
 *                 properties:
 *                   status: { type: string }
 *                   priority: { type: string }
 *                   assigned_to: { type: integer }
 *     responses:
 *       200: { description: File stream (csv/xlsx) or JSON array }
 *       401: { description: Unauthenticated }
 *       422: { description: team_id missing or invalid format }
 */
router.post('/tasks', authenticateJwt, async (req, res) => {
  const { team_id: teamId, format = 'csv', filters = {} } = req.body;

  if (!teamId) {
    return res.status(422).json({ message: 'team_id is required.' });
  }

  if (!['csv', 'json', 'xlsx'].includes(format)) {
    return res.status(422).json({ message: 'format must be one of csv, json, xlsx.' });
  }

  try {
    const client = laravelClientForUser(req.token);
    const tasks = await fetchAllTeamTasks(client, teamId, {
      status: filters.status,
      priority: filters.priority,
      assignedTo: filters.assigned_to,
    });

    const rows = tasks.map((task) => Object.fromEntries(EXPORT_COLUMNS.map((col) => [col, task[col]])));

    if (format === 'json') {
      return res.json(rows);
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="tasks-team-${teamId}.csv"`);
      const stream = formatCsv({ headers: true });
      stream.pipe(res);
      rows.forEach((row) => stream.write(row));
      stream.end();
      return;
    }

    // xlsx
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="tasks-team-${teamId}.xlsx"`);

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
    const sheet = workbook.addWorksheet('Tasks');
    sheet.columns = EXPORT_COLUMNS.map((col) => ({ header: col, key: col }));
    rows.forEach((row) => sheet.addRow(row).commit());
    sheet.commit();
    await workbook.commit();
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    res.status(502).json({ message: 'Failed to reach Laravel API.' });
  }
});

export default router;
