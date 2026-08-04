import { renderEmail, escapeHtml } from './emailLayout.js';

const TEMPLATES = {
  task_assigned: (details) => {
    const title = details.title ?? 'a task';
    const priority = details.priority ?? 'n/a';
    const dueDate = details.due_date ?? 'n/a';

    return {
      subject: `You've been assigned: ${title}`,
      text: `You were assigned a new task: "${title}".\nPriority: ${priority}\nDue: ${dueDate}`,
      html: renderEmail({
        heading: "You've been assigned a task",
        bodyHtml: `
          <p>You were assigned <strong>"${escapeHtml(title)}"</strong>.</p>
          <p style="margin:16px 0 0;">
            <strong>Priority:</strong> ${escapeHtml(priority)}<br>
            <strong>Due:</strong> ${escapeHtml(dueDate)}
          </p>
        `,
      }),
    };
  },
  task_status_changed: (details) => {
    const title = details.title ?? '';
    const fromStatus = details.from_status ?? '?';
    const toStatus = details.to_status ?? '?';

    return {
      subject: `Task status updated: ${title}`,
      text: `"${title}" changed from ${fromStatus} to ${toStatus}.`,
      html: renderEmail({
        heading: 'Task status updated',
        bodyHtml: `
          <p><strong>"${escapeHtml(title)}"</strong> changed status:</p>
          <p style="margin:16px 0 0;">
            <span style="color:#9ca3af; text-decoration:line-through;">${escapeHtml(fromStatus)}</span>
            &nbsp;&rarr;&nbsp;
            <strong style="color:#111827;">${escapeHtml(toStatus)}</strong>
          </p>
        `,
      }),
    };
  },
  deadline_reminder: (details) => {
    const title = details.title ?? '';
    const dueDate = details.due_date ?? 'soon';

    return {
      subject: `Reminder: "${title}" is due soon`,
      text: `"${title}" is due on ${dueDate}. Don't forget to complete it.`,
      html: renderEmail({
        heading: 'Deadline reminder',
        bodyHtml: `
          <p><strong>"${escapeHtml(title)}"</strong> is due on <strong>${escapeHtml(dueDate)}</strong>.</p>
          <p style="margin:16px 0 0;">Don't forget to complete it.</p>
        `,
      }),
    };
  },
  task_archived: (details) => {
    const title = details.title ?? '';

    return {
      subject: `Task archived: ${title}`,
      text: `"${title}" has been archived.`,
      html: renderEmail({
        heading: 'Task archived',
        bodyHtml: `<p><strong>"${escapeHtml(title)}"</strong> has been archived.</p>`,
      }),
    };
  },
  daily_digest: (details) => {
    const tasks = details.tasks ?? [];
    const fallbackSummary = details.summary ?? 'You have incomplete tasks. Log in to review them.';

    const listItems = tasks
      .map(
        (t) =>
          `<li style="margin-bottom:8px;"><strong>[${escapeHtml(t.priority)}]</strong> ${escapeHtml(t.title)} (due ${escapeHtml(t.due_date ?? 'no due date')})</li>`
      )
      .join('');

    return {
      subject: 'Your daily task digest',
      text: fallbackSummary,
      html: renderEmail({
        heading: 'Your daily task digest',
        bodyHtml: tasks.length
          ? `<p>You have ${tasks.length} incomplete task(s):</p><ul style="padding-left:20px; margin:16px 0 0;">${listItems}</ul>`
          : `<p>${escapeHtml(fallbackSummary)}</p>`,
      }),
    };
  },
};

export function buildNotification(eventType, details = {}) {
  const builder = TEMPLATES[eventType];

  if (!builder) {
    const text = JSON.stringify(details);
    return {
      subject: `Task Management notification: ${eventType}`,
      text,
      html: renderEmail({
        heading: 'Notification',
        bodyHtml: `<p>${escapeHtml(text)}</p>`,
      }),
    };
  }

  return builder(details);
}
