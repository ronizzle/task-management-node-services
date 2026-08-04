import { Router } from 'express';
import { authenticateInternalToken } from '../middleware/internalToken.js';
import { broadcastToRoom } from '../realtime/socket.js';

const router = Router();

/**
 * @openapi
 * /api/realtime/broadcast:
 *   post:
 *     tags: [Realtime]
 *     summary: Broadcast a Socket.IO event to a room (internal — called by Laravel only)
 *     security: [{ internalToken: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [room, event]
 *             properties:
 *               room: { type: string, example: "task:42" }
 *               event: { type: string, example: task_updated }
 *               payload: { type: object }
 *     responses:
 *       202: { description: Accepted for broadcast }
 *       401: { description: Invalid or missing internal service token }
 *       422: { description: Missing room or event }
 */
router.post('/broadcast', authenticateInternalToken, (req, res) => {
  const { room, event, payload } = req.body;

  if (!room || !event) {
    return res.status(422).json({ message: 'room and event are required.' });
  }

  broadcastToRoom(room, event, payload ?? {});

  res.status(202).json({ message: 'Broadcast accepted.' });
});

export default router;
