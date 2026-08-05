process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_jest_only';
process.env.INTERNAL_SERVICE_TOKEN = 'test_internal_token_for_jest_only';

// Set (not delete) to an empty string — dotenv.config() (called by
// src/config/env.js) skips keys already present in process.env, even empty
// ones, so this stops the local .env's real Brevo key from being loaded
// into test runs and making real network calls out to Brevo. Individual
// tests (see brevo.test.js) can still override this per-test as needed.
process.env.BREVO_API_KEY = '';

// Jest runs each test file in its own worker process, but test files that
// spin up a fake Laravel HTTP server (see tests/helpers/fakeLaravel.js) all
// bind the *same* TCP port — a fixed port would race across concurrent
// workers. JEST_WORKER_ID gives each worker process a stable, distinct id,
// so deriving the port from it keeps every worker on its own port while
// test files within the same worker (run sequentially) safely reuse it.
const workerId = Number(process.env.JEST_WORKER_ID || '1');
process.env.FAKE_LARAVEL_PORT = String(9900 + workerId);
process.env.LARAVEL_API_URL = `http://127.0.0.1:${process.env.FAKE_LARAVEL_PORT}/api`;
