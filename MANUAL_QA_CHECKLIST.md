# Manual QA Checklist — Node Services

Manual test checklist scoped to this service's surface: notifications, analytics, export, scheduled jobs, and the backend half of Socket.io real-time updates. Run against the live deployment via the React frontend (this service has no user-facing pages of its own). A full cross-service checklist (Laravel + React flows included) lives in the umbrella `task-management` repo as `MANUAL_QA_CHECKLIST.md`.

## Environment

| Service | URL |
|---|---|
| Frontend (drives most of these checks) | https://task-management-react-frontend-spyn.onrender.com |
| This service | https://task-management-node-services-u5bj.onrender.com/api |
| Laravel API (source of task/user data) | https://task-management-laravel-api-jryf.onrender.com/api |

**Credentials** (seeded, all `password123`): `admin@test.com` · `manager@test.com` · `member@test.com`

**Note:** free-tier Render spins down when idle — first request can take 30–60s. Hit the URL once and let it wake before timed steps.

---

## Analytics

Admin/Manager only; Manager scoped to own team. 1hr in-memory cache, no Redis.

- [ ] `GET /api/analytics/task-summary?team_id=…` returns `{ total_tasks, completed_tasks, pending_tasks, avg_completion_time }`
- [ ] `date_from`/`date_to` narrow the result correctly
- [ ] `GET /api/analytics/team-productivity` returns sensible data
- [ ] `GET /api/analytics/upcoming-deadlines` returns tasks due soon
- [ ] As Manager, the endpoints only return data for their own team, even if a different `team_id` is passed
- [ ] As Team Member, these endpoints return 403 (via the JWT they forward from Laravel's auth)
- [ ] Change a task's status, re-check analytics — expect up to a 1hr lag from the in-memory cache, not a bug

## Export

- [ ] `POST /api/export/tasks { team_id, format: "csv" }` streams a CSV matching the team's tasks
- [ ] Same with `format: "json"` and `format: "xlsx"` — both open cleanly
- [ ] Passing `filters` (status/priority/assignee) narrows the export to match

## Scheduled jobs (node-cron)

Daily Digest (8am) — incomplete tasks per user, email summary. Deadline Reminder (every 2h) — tasks due within 24h. Task Cleanup (midnight) — soft-deletes cancelled tasks >30 days old via Laravel's archive endpoint.

- [ ] Set a task's due date within 24h — a deadline-reminder email arrives at the assignee
- [ ] Around 8am server time, a daily digest email arrives listing incomplete tasks
- [ ] A cancelled task older than 30 days gets archived by the cleanup job (hard to trigger live without seed manipulation — otherwise covered by the Node test suite for graceful shutdown/retry)

---

## Bonus features (Node side)

### Notifications → HTML email templates (Brevo)

- [ ] Assign a task to another user — a "task assigned" email arrives, and is styled HTML (not plain text) when opened in a real mail client
- [ ] Change a task's status — a "status changed" email arrives
- [ ] Assign a task with special characters in the title (e.g. `<b>test</b>`) — the email shows it literally, not as injected markup
- [ ] The daily digest email renders its task list as an actual `<ul>`, not a dash-separated text block
- [ ] Notification send is async — the triggering UI action (assign/status-change) doesn't hang waiting on the email

### Request/response logging

- [ ] (Needs Render log access) every request logs one JSON line on the `finish` event with method/path/status/duration/user id (from `req.userId`, set by `authenticateJwt`)/IP, and never the request body

### Socket.io real-time updates (server side)

- [ ] Socket handshake requires a valid JWT (same secret/algorithm as the REST API) — a connection with no/invalid token is rejected
- [ ] `join:task` / `join:team` rooms only receive events for that task/team
- [ ] `POST /api/realtime/broadcast` (internal-token protected) rejects requests without the internal token
- [ ] End-to-end: change a task's status via the API, confirm a connected Socket.IO client in that task's room receives the event — easiest to observe by watching two logged-in React windows update live on the same task
