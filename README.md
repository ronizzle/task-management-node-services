# task-management-node-services

Node.js/Express services — notifications, analytics, exports, and scheduled jobs for the Task Management & Analytics Platform. Has no database of its own: every data need is an HTTP call back into `task-management-laravel-api`.

Part of the [task-management](https://github.com/ronizzle/task-management) umbrella project. See that repo's `plan.md` for the full spec.

## Requirements

- Node.js 20+
- `task-management-laravel-api` running and reachable

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:
- `JWT_SECRET` — must exactly match Laravel's `JWT_SECRET`. Node verifies the same JWTs Laravel issues (`tymon/jwt-auth`, HS256) independently — it never asks Laravel to validate a token for it.
- `INTERNAL_SERVICE_TOKEN` — must exactly match Laravel's `INTERNAL_SERVICE_TOKEN`. Used both ways: Node sends it as `X-Internal-Token` on cron-triggered calls to Laravel, and this service requires it on its own `/api/notifications/send` endpoint (only Laravel should call that).
- `LARAVEL_API_URL` — Laravel's base API URL (default `http://localhost:8000/api`).
- `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` — for transactional email. If `BREVO_API_KEY` is unset, sends are skipped with a warning (useful for local dev without a Brevo account).

```bash
npm start        # production
npm run dev      # nodemon, auto-restart
```

Runs on **3000** locally.

## Auth model

Node has two ways of authenticating to Laravel, matching the two ways things call Node:

- **User-triggered** (e.g. a logged-in Manager hits `/api/analytics/task-summary`): Node forwards the same JWT it received in `Authorization: Bearer <token>`. Laravel's normal role-based authorization applies automatically to any data Node fetches on the user's behalf.
- **Cron-triggered** (node-cron jobs, no user in context): Node calls Laravel with `X-Internal-Token: <INTERNAL_SERVICE_TOKEN>` instead. Laravel treats this as a trusted system actor with broad read access on the specific routes cron needs (teams, team tasks, users, task archive).

Endpoints Node itself exposes:
- `/api/analytics/*` and `/api/export/tasks` require a forwarded user JWT (`authenticateJwt`). Since the underlying Laravel task-list endpoint doesn't restrict by role — team members are valid team members too — Node calls `GET /users/{id}` on Laravel (via the same forwarded JWT) to learn the caller's role, then enforces the Admin/Manager-only gate locally (`requireLaravelUser` + `requireAdminOrManager`) before proceeding. A Manager scoped to a team they don't belong to gets Laravel's own 403 forwarded straight through.
- `/api/notifications/send` requires `X-Internal-Token` — Laravel is the only intended caller.

## API surface

**Notifications**: `POST /api/notifications/send` — internal only, called by Laravel with `{ task_id, user_id, event_type, details }`. Returns `202` immediately; the actual Brevo send happens in the background so a slow/failed email never blocks Laravel's request.

**Analytics** (Admin/Manager only; Manager scoped to own team by Laravel):
- `GET /api/analytics/task-summary?team_id=&date_from=&date_to=` → `{ total_tasks, completed_tasks, pending_tasks, avg_completion_time }`
- `GET /api/analytics/team-productivity?team_id=`
- `GET /api/analytics/upcoming-deadlines?team_id=&within_hours=`

All three cache their result for 1 hour (in-memory, timestamp-based — no Redis, to avoid an extra paid Render service). Responses include `"cached": true|false`.

**Export**: `POST /api/export/tasks` `{ team_id, format: csv|json|xlsx, filters }` → file stream (`fast-csv` for CSV, `exceljs` for XLSX).

## Scheduled jobs (node-cron)

| Job | Schedule | What it does |
|---|---|---|
| Daily Digest | `0 8 * * *` (8 AM) | Emails each user their incomplete (pending/in_progress) tasks |
| Deadline Reminder | `0 */2 * * *` (every 2h) | Emails users whose assigned tasks are due within 24h |
| Task Cleanup | `0 0 * * *` (midnight) | Archives (soft-deletes) cancelled tasks older than 30 days via Laravel's archive endpoint |

All three use `withRetry` (exponential backoff, 3 attempts) around their Laravel calls so a transient network blip doesn't skip a whole run. On `SIGTERM`/`SIGINT`, the server stops accepting new cron triggers and waits for any run already in flight to finish before exiting (see `src/server.js`).

## Rate limiting

`/api/notifications`, `/api/analytics`, and `/api/export` are all throttled via `express-rate-limit`: **60 requests/minute per IP**. Exceeding it returns `429` with `{ "message": "Too many requests, please try again later." }` and standard `RateLimit-*` headers.

## Request/response logging (bonus)

Every request is logged (one JSON line per request, via `console.log`) by `requestLogger` middleware in `src/app.js` — method, path, response status, duration in ms, authenticated user id (`null` if unauthenticated), and IP. The request body is never logged, so notification payloads/tokens can't leak into stdout or Render's log stream.

## API docs (Swagger/OpenAPI)

See `/api-docs` once the server is running (generated from JSDoc comments via `swagger-jsdoc` + `swagger-ui-express`).

## Tests

```bash
npm test
```

26 Jest tests covering JWT/internal-token middleware (accept/reject paths), the in-memory cache's TTL behavior, notification template building, unauthenticated-access rejection on every protected route, rate limiting (429 after the limit, `RateLimit-*` headers, shared budget across routes, unaffected `/health`), and request/response logging (status/user captured, body never logged).

## Deployment

Live on Render: **https://task-management-node-services-u5bj.onrender.com/api**

- Render Web Service, Node runtime. Build `npm install`, start `npm start`.
- `LARAVEL_API_URL` points at the production Laravel URL; `JWT_SECRET` and `INTERNAL_SERVICE_TOKEN` match Laravel's values exactly. `PUBLIC_URL` is set so the Swagger UI "server" dropdown resolves correctly in production.
- `BREVO_API_KEY`/`BREVO_SENDER_EMAIL`/`BREVO_SENDER_NAME` set for live transactional email.
- Health check: `GET /health`.
