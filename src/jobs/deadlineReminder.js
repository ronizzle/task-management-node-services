import { laravelClientForInternalService } from '../services/laravelClient.js';
import { fetchAllTasksAcrossTeams } from '../services/taskData.js';
import { sendEmail } from '../services/brevo.js';
import { buildNotification } from '../services/notificationTemplates.js';
import { withRetry } from '../utils/retry.js';

const WITHIN_HOURS = 24;

/**
 * Deadline Reminder — every 2h — tasks due within 24h.
 */
export async function runDeadlineReminder() {
  const client = laravelClientForInternalService();
  const tasks = await withRetry(() => fetchAllTasksAcrossTeams(client));

  const now = Date.now();
  const horizon = now + WITHIN_HOURS * 60 * 60 * 1000;

  const dueSoon = tasks.filter((task) => {
    if (!task.due_date || !task.assigned_to) return false;
    if (['completed', 'cancelled'].includes(task.status)) return false;

    const due = new Date(task.due_date).getTime();
    return due >= now && due <= horizon;
  });

  let sent = 0;
  let failed = 0;

  for (const task of dueSoon) {
    try {
      await withRetry(async () => {
        const { data: user } = await client.get(`/users/${task.assigned_to}`);
        if (!user?.email || !user.is_active) return;

        const { subject, text } = buildNotification('deadline_reminder', {
          title: task.title,
          due_date: task.due_date,
        });

        await sendEmail({ to: user.email, subject, text });
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error('[deadline-reminder] failed for task', task.id, err.message);
    }
  }

  console.log(`[deadline-reminder] done: ${sent} sent, ${failed} failed, ${dueSoon.length} tasks due within ${WITHIN_HOURS}h`);
  return { sent, failed };
}
