import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV !== 'test') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  // Public base URL of this service itself (e.g. its Render URL) — used only
  // to make the Swagger UI's "server" dropdown correct in production.
  publicUrl: process.env.PUBLIC_URL || '',
  jwtSecret: required('JWT_SECRET'),
  internalServiceToken: required('INTERNAL_SERVICE_TOKEN'),
  laravelApiUrl: process.env.LARAVEL_API_URL || 'http://localhost:8000/api',
  brevo: {
    apiKey: process.env.BREVO_API_KEY || '',
    senderEmail: process.env.BREVO_SENDER_EMAIL || 'no-reply@example.com',
    senderName: process.env.BREVO_SENDER_NAME || 'Task Management Platform',
  },
  analyticsCacheTtlMs: parseInt(process.env.ANALYTICS_CACHE_TTL_MS || '3600000', 10),
};
