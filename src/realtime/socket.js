import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

let io = null;

/**
 * Attaches Socket.IO to the same HTTP server Express listens on. Auth
 * mirrors authenticateJwt (src/middleware/auth.js) — same JWT_SECRET Laravel
 * signs with, verified at handshake time so unauthenticated sockets never
 * connect at all.
 *
 * Room membership is client-directed ("join this task/team's room") rather
 * than server-verified against Laravel's per-resource authorization. Any
 * authenticated user can join any task/team room by id. This mirrors the
 * trust boundary Node already has everywhere else (e.g. analytics endpoints
 * trust the forwarded JWT and rely on Laravel having gated the underlying
 * data access), but unlike REST, a guessed task/team id here isn't re-checked
 * against team membership — acceptable for this scope since no task/team
 * content is ever emitted over the socket, only change notifications
 * (ids, titles, statuses) that Laravel already includes in its own
 * broadcast payload.
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Unauthenticated'));
    }

    try {
      const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('Unauthenticated'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join:task', (taskId) => {
      if (taskId) socket.join(`task:${taskId}`);
    });

    socket.on('leave:task', (taskId) => {
      if (taskId) socket.leave(`task:${taskId}`);
    });

    socket.on('join:team', (teamId) => {
      if (teamId) socket.join(`team:${teamId}`);
    });

    socket.on('leave:team', (teamId) => {
      if (teamId) socket.leave(`team:${teamId}`);
    });
  });

  return io;
}

/**
 * Emits `event` with `payload` to every socket in `room`. No-op (logged) if
 * called before initSocket() — e.g. in a unit test that imports this module
 * without booting a server.
 */
export function broadcastToRoom(room, event, payload) {
  if (!io) {
    console.warn('[realtime] broadcastToRoom called before initSocket()', { room, event });
    return;
  }

  io.to(room).emit(event, payload);
}

/** Test-only: lets tests reset the module-level io reference between runs. */
export function _resetForTests() {
  io = null;
}
