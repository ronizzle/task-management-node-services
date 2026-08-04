import cron from 'node-cron';
import { runDailyDigest } from './dailyDigest.js';
import { runDeadlineReminder } from './deadlineReminder.js';
import { runTaskCleanup } from './taskCleanup.js';

const SCHEDULES = [
  { name: 'daily-digest', cronExpr: '0 8 * * *', run: runDailyDigest },
  { name: 'deadline-reminder', cronExpr: '0 */2 * * *', run: runDeadlineReminder },
  { name: 'task-cleanup', cronExpr: '0 0 * * *', run: runTaskCleanup },
];

let tasks = [];
const inFlight = new Set();

export function startJobs() {
  tasks = SCHEDULES.map(({ name, cronExpr, run }) =>
    cron.schedule(cronExpr, () => runGuarded(name, run))
  );
  console.log(`[jobs] scheduled ${tasks.length} cron job(s): ${SCHEDULES.map((s) => s.name).join(', ')}`);
  return tasks;
}

async function runGuarded(name, run) {
  console.log(`[jobs] starting ${name}`);
  const promise = run().catch((err) => {
    console.error(`[jobs] ${name} failed:`, err.message);
  });

  inFlight.add(promise);
  try {
    await promise;
  } finally {
    inFlight.delete(promise);
  }
}

/** Stops accepting new scheduled triggers; does not interrupt runs in flight. */
export function stopJobs() {
  tasks.forEach((task) => task.stop());
}

/** Resolves once every currently-running job finishes. Used during graceful shutdown. */
export async function waitForInFlightJobs() {
  await Promise.all([...inFlight]);
}

export { SCHEDULES };
