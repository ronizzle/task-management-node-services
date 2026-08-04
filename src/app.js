import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import notificationsRouter from './routes/notifications.js';
import analyticsRouter from './routes/analytics.js';
import exportRouter from './routes/export.js';
import swaggerSpec from './config/swagger.js';
import { requestLogger } from './middleware/requestLogger.js';

export function createApp() {
  const app = express();

  // Instantiated per app rather than at module scope so each createApp()
  // call (e.g. one per test) gets its own counter store instead of sharing
  // state with every other instance.
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
  });

  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use('/api/notifications', apiLimiter, notificationsRouter);
  app.use('/api/analytics', apiLimiter, analyticsRouter);
  app.use('/api/export', apiLimiter, exportRouter);

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
