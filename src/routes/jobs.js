import { Router } from 'express';
import { authenticateInternalToken } from '../middleware/internalToken.js';
import { runDailyDigest } from '../jobs/dailyDigest.js';

const router = Router();

/**
 * @openapi
 * /internal/jobs/daily-digest:
 *   post:
 *     tags: [Jobs]
 *     summary: Manually trigger the daily digest job (internal — bypasses the 8 AM cron schedule)
 *     security: [{ internalToken: [] }]
 *     responses:
 *       200:
 *         description: Digest run completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sent: { type: integer }
 *                 failed: { type: integer }
 *       401: { description: Invalid or missing internal service token }
 *       500: { description: Digest run failed }
 */
router.post('/daily-digest', authenticateInternalToken, async (req, res) => {
  try {
    const result = await runDailyDigest();
    res.status(200).json(result);
  } catch (err) {
    console.error('[jobs] daily-digest manual trigger failed', err.message);
    res.status(500).json({ message: 'Daily digest run failed.' });
  }
});

export default router;
