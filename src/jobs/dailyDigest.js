import { laravelClientForInternalService } from '../services/laravelClient.js';
import { fetchAllTasksAcrossTeams } from '../services/taskData.js';
import { sendEmail } from '../services/brevo.js';
import { buildNotification } from '../services/notificationTemplates.js';
import { withRetry } from '../utils/retry.js';

/**
 * Daily Digest — 8 AM — incomplete tasks per user, emailed as a summary.
 */
export async function runDailyDigest() {
  const client = laravelClientForInternalService();
  const tasks = await withRetry(() => fetchAllTasksAcrossTeams(client));

  const incomplete = tasks.filter((t) => ['pending', 'in_progress'].includes(t.status));
  const byUser = groupByAssignee(incomplete);

  let sent = 0;
  let failed = 0;

  for (const [userId, userTasks] of byUser.entries()) {
    try {
      await withRetry(async () => {
        const { data: user } = await client.get(`/users/${userId}`);
        if (!user?.email || !user.is_active) return;

        const summary = userTasks
          .map((t) => `- [${t.priority}] ${t.title} (due ${t.due_date ?? 'no due date'})`)
          .join('\n');

        const { subject, text, html } = buildNotification('daily_digest', {
          tasks: userTasks,
          summary: `You have ${userTasks.length} incomplete task(s):\n${summary}`,
        });

        await sendEmail({ to: user.email, subject, text, html });
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error('[daily-digest] failed for user', userId, err.message);
    }
  }

  console.log(`[daily-digest] done: ${sent} sent, ${failed} failed, ${byUser.size} users with incomplete tasks`);
  return { sent, failed };
}

function groupByAssignee(tasks) {
  const map = new Map();
  for (const task of tasks) {
    if (!task.assigned_to) continue;
    if (!map.has(task.assigned_to)) map.set(task.assigned_to, []);
    map.get(task.assigned_to).push(task);
  }
  return map;
}
