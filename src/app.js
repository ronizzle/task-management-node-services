import express from 'express';
import cors from 'cors';
import notificationsRouter from './routes/notifications.js';
import analyticsRouter from './routes/analytics.js';
import exportRouter from './routes/export.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/notifications', notificationsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/export', exportRouter);

  app.use((req, res) => {
    res.status(404).json({ message: 'Not found.' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[unhandled error]', err);
    res.status(500).json({ message: 'Internal server error.' });
  });

  return app;
}
