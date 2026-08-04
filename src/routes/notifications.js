import { Router } from 'express';
import { authenticateInternalToken } from '../middleware/internalToken.js';
import { laravelClientForInternalService } from '../services/laravelClient.js';
import { sendEmail } from '../services/brevo.js';
import { buildNotification } from '../services/notificationTemplates.js';

const router = Router();

router.post('/send', authenticateInternalToken, (req, res) => {
  const { task_id: taskId, user_id: userId, event_type: eventType, details } = req.body;

  if (!userId || !eventType) {
    return res.status(422).json({ message: 'user_id and event_type are required.' });
  }

  // Respond immediately; the actual email send happens in the background.
  res.status(202).json({ message: 'Notification accepted for processing.' });

  processNotification({ taskId, userId, eventType, details: details ?? {} }).catch((err) => {
    console.error('[notifications] failed to process notification', {
      userId,
      eventType,
      error: err.message,
    });
  });
});

async function processNotification({ userId, eventType, details }) {
  const client = laravelClientForInternalService();
  const { data: user } = await client.get(`/users/${userId}`);

  if (!user?.email) {
    throw new Error(`No email on file for user ${userId}`);
  }

  const { subject, text } = buildNotification(eventType, details);

  await sendEmail({ to: user.email, subject, text });
}

export default router;
