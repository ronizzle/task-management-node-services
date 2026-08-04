import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env.js';

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Task Management Node Services',
      version: '1.0.0',
      description:
        'Notifications, analytics, exports, and cron jobs for the Task Management & Analytics Platform. Has no database of its own — reads/writes go through task-management-laravel-api.',
    },
    servers: [{ url: `http://localhost:${env.port}`, description: 'Local' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        internalToken: { type: 'apiKey', in: 'header', name: 'X-Internal-Token' },
      },
    },
    tags: [
      { name: 'Notifications', description: 'Internal endpoint called by Laravel' },
      { name: 'Analytics', description: 'Admin/Manager only, team-scoped for Managers' },
      { name: 'Export', description: 'Task export as CSV, JSON, or XLSX' },
    ],
  },
  apis: ['./src/routes/*.js'],
});

export default spec;
