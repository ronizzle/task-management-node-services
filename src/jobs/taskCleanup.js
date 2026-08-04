import { laravelClientForInternalService } from '../services/laravelClient.js';
import { fetchAllTasksAcrossTeams } from '../services/taskData.js';
import { withRetry } from '../utils/retry.js';

const CANCELLED_RETENTION_DAYS = 30;

/**
 * Task Cleanup — midnight — soft-deletes (archives) cancelled tasks older
 * than 30 days by calling Laravel's archive endpoint. No cancelled_at
 * column exists, so updated_at (last status change) is used as the
 * cancellation timestamp.
 */
export async function runTaskCleanup() {
  const client = laravelClientForInternalService();
  const tasks = await withRetry(() => fetchAllTasksAcrossTeams(client));

  const cutoff = Date.now() - CANCELLED_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const stale = tasks.filter((task) => {
    if (task.status !== 'cancelled' || task.archived_at) return false;
    return new Date(task.updated_at).getTime() < cutoff;
  });

  let archived = 0;
  let failed = 0;

  for (const task of stale) {
    try {
      await withRetry(() => client.delete(`/tasks/${task.id}/archive`));
      archived += 1;
    } catch (err) {
      failed += 1;
      console.error('[task-cleanup] failed to archive task', task.id, err.message);
    }
  }

  console.log(`[task-cleanup] done: ${archived} archived, ${failed} failed, ${stale.length} eligible`);
  return { archived, failed };
}
