const TEMPLATES = {
  task_assigned: (details) => ({
    subject: `You've been assigned: ${details.title ?? 'a task'}`,
    text: `You were assigned a new task: "${details.title ?? ''}".\nPriority: ${details.priority ?? 'n/a'}\nDue: ${details.due_date ?? 'n/a'}`,
  }),
  task_status_changed: (details) => ({
    subject: `Task status updated: ${details.title ?? ''}`,
    text: `"${details.title ?? ''}" changed from ${details.from_status ?? '?'} to ${details.to_status ?? '?'}.`,
  }),
  deadline_reminder: (details) => ({
    subject: `Reminder: "${details.title ?? ''}" is due soon`,
    text: `"${details.title ?? ''}" is due on ${details.due_date ?? 'soon'}. Don't forget to complete it.`,
  }),
  task_archived: (details) => ({
    subject: `Task archived: ${details.title ?? ''}`,
    text: `"${details.title ?? ''}" has been archived.`,
  }),
  daily_digest: (details) => ({
    subject: 'Your daily task digest',
    text: details.summary ?? 'You have incomplete tasks. Log in to review them.',
  }),
};

export function buildNotification(eventType, details = {}) {
  const builder = TEMPLATES[eventType];

  if (!builder) {
    return {
      subject: `Task Management notification: ${eventType}`,
      text: JSON.stringify(details),
    };
  }

  return builder(details);
}
