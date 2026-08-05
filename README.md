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

**Notifications**: `POST /api/notifications/send` — internal only, called by Laravel with `{ task_id, user_id, event_type, details }`. Returns `202` immediately; the actual Brevo send happens in the background so a slow/failed email never blocks Laravel's request. Emails are sent as HTML (with a plain-text fallback) — see "HTML email templates" below.

**Analytics** (Admin/Manager only; Manager scoped to own team by Laravel):
- `GET /api/analytics/task-summary?team_id=&date_from=&date_to=` → `{ total_tasks, completed_tasks, pending_tasks, avg_completion_time }`
- `GET /api/analytics/team-productivity?team_id=`
- `GET /api/analytics/upcoming-deadlines?team_id=&within_hours=`

All three cache their result for 1 hour (in-memory, timestamp-based — no Redis, to avoid an extra paid Render service). Responses include `"cached": true|false`.

**Export**: `POST /api/export/tasks` `{ team_id, format: csv|json|xlsx, filters }` → file stream (`fast-csv` for CSV, `exceljs` for XLSX).

**Realtime**: `POST /api/realtime/broadcast` — internal only, called by Laravel with `{ room, event, payload }`. See "Real-time updates (Socket.IO, bonus)" below.

## Real-time updates (Socket.IO, bonus)

Live task/comment updates pushed to connected clients over Socket.IO, attached to the same HTTP server as the REST API (`src/server.js`).

- **Auth handshake**: the client connects with `auth: { token }`, the same JWT Laravel issues and the REST API already validates. `src/realtime/socket.js` verifies it with the shared `JWT_SECRET` (HS256) at connect time — no token, no connection.
- **Rooms**: client-directed via `join:task` / `leave:task` (task id) and `join:team` / `leave:team` (team id). Any authenticated socket can join any room by id — Node has no way to check per-resource team membership itself (see "Node has no direct DB access" in `plan.md`), so this is a step looser than the REST API's authorization. It's an acceptable tradeoff here because only change *notifications* (ids, titles, statuses — no task body/description) go out over the socket, and the same fields are visible in Laravel's own broadcast payload.
- **Broadcast trigger**: Laravel's `App\Services\RealtimeBroadcaster` calls `POST /api/realtime/broadcast` (internal-token protected, same pattern as `/api/notifications/send`) after every relevant task/comment write; `broadcastToRoom()` then emits to that Socket.IO room. A failed/unreachable broadcast is caught and logged on the Laravel side — it never fails the underlying request.
- **Events**: `task_created`, `task_updated`, `task_status_changed`, `task_deleted`, `task_archived` (to `team:{team_id}`; the last three also to `task:{task_id}`), `comment_created`, `comment_deleted` (to `task:{task_id}`).

## Scheduled jobs (node-cron)

| Job | Schedule | What it does |
|---|---|---|
| Daily Digest | `0 8 * * *` (8 AM) | Emails each user their incomplete (pending/in_progress) tasks |
| Deadline Reminder | `0 */2 * * *` (every 2h) | Emails users whose assigned tasks are due within 24h |
| Task Cleanup | `0 0 * * *` (midnight) | Archives (soft-deletes) cancelled tasks older than 30 days via Laravel's archive endpoint |

All three use `withRetry` (exponential backoff, 3 attempts) around their Laravel calls so a transient network blip doesn't skip a whole run. On `SIGTERM`/`SIGINT`, the server stops accepting new cron triggers and waits for any run already in flight to finish before exiting (see `src/server.js`).

## HTML email templates (bonus)

All five notification templates (`task_assigned`, `task_status_changed`, `deadline_reminder`, `task_archived`, `daily_digest`) — plus the generic fallback for an unmapped `event_type` — now render as HTML, not just plain text. `buildNotification()` (`src/services/notificationTemplates.js`) returns `{ subject, text, html }`; `sendEmail()` (`src/services/brevo.js`) sends both `textContent` and `htmlContent` to Brevo (`textContent` alone if a caller doesn't supply `html`, so nothing breaks for any future template that skips it). The HTML is built with `renderEmail()` (`src/services/emailLayout.js`) — a small table-based, inline-styled layout (email clients strip `<style>` blocks) shared by every template, with all interpolated values passed through `escapeHtml()` so a task title can't inject markup into the email. The daily digest renders its task list as an actual `<ul>` instead of a dash-separated text block.

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

63 Jest tests covering JWT/internal-token middleware (accept/reject paths), the in-memory cache's TTL behavior, notification template building (including HTML output, HTML-escaping of interpolated values, and the daily digest task list), the Brevo client (`htmlContent` forwarded when present, omitted when absent, skips sending with no API key), unauthenticated-access rejection on every protected route, rate limiting (429 after the limit, `RateLimit-*` headers, shared budget across routes, unaffected `/health`), request/response logging (status/user captured, body never logged), Socket.IO realtime (handshake rejects a missing/invalid JWT, accepts a valid one, room-scoped delivery via a real client/server pair, `/api/realtime/broadcast` internal-token guard and validation), the three analytics routes' computed values (totals, avg completion time, per-member productivity, upcoming-deadline filtering) and caching against a fake Laravel backend (`tests/helpers/fakeLaravel.js`), the export route (422 validation, CSV/JSON/XLSX output, filter scoping), the three cron jobs' filtering logic (daily digest grouping, deadline-reminder's 24h window, task-cleanup's 30-day/already-archived rules), and notification-send validation.

## Deployment

Live on Render: **https://task-management-node-services-u5bj.onrender.com/api**

- Render, because it offers a free tier for Web Services — no cost for this assessment.
- Render Web Service, Node runtime. Build `npm install`, start `npm start`.
- `LARAVEL_API_URL` points at the production Laravel URL; `JWT_SECRET` and `INTERNAL_SERVICE_TOKEN` match Laravel's values exactly. `PUBLIC_URL` is set so the Swagger UI "server" dropdown resolves correctly in production.
- `BREVO_API_KEY`/`BREVO_SENDER_EMAIL`/`BREVO_SENDER_NAME` set for live transactional email.
- Health check: `GET /health`.
