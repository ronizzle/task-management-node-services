import axios from 'axios';
import { env } from '../config/env.js';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Sends a transactional email via Brevo's HTTP API. Errors are caught by
 * the caller (background job in the notifications route) — a failed email
 * must never fail the HTTP response that triggered it.
 */
export async function sendEmail({ to, subject, text }) {
  if (!env.brevo.apiKey) {
    console.warn('[brevo] BREVO_API_KEY not set — skipping email send:', subject);
    return { skipped: true };
  }

  const response = await axios.post(
    BREVO_SEND_URL,
    {
      sender: { email: env.brevo.senderEmail, name: env.brevo.senderName },
      to: [{ email: to }],
      subject,
      textContent: text,
    },
    {
      headers: {
        'api-key': env.brevo.apiKey,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}
