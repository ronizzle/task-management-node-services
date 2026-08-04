import { createApp } from './app.js';
import { env } from './config/env.js';
import { startJobs, stopJobs, waitForInFlightJobs } from './jobs/index.js';

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`[server] task-management-node-services listening on port ${env.port}`);
});

startJobs();

async function shutdown(signal) {
  console.log(`[server] received ${signal}, shutting down gracefully`);

  stopJobs();
  server.close(() => console.log('[server] HTTP server closed'));

  try {
    await waitForInFlightJobs();
    console.log('[server] all in-flight jobs finished');
  } catch (err) {
    console.error('[server] error while waiting for in-flight jobs', err);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
