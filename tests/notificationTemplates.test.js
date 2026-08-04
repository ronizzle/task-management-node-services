import { buildNotification } from '../src/services/notificationTemplates.js';

describe('buildNotification', () => {
  it('builds a task_assigned notification with the task title in the subject', () => {
    const { subject, text } = buildNotification('task_assigned', { title: 'Fix login bug', priority: 'high' });

    expect(subject).toContain('Fix login bug');
    expect(text).toContain('high');
  });

  it('builds a deadline_reminder notification', () => {
    const { subject, text } = buildNotification('deadline_reminder', {
      title: 'Write docs',
      due_date: '2026-01-01',
    });

    expect(subject).toContain('Write docs');
    expect(text).toContain('2026-01-01');
  });

  it('falls back to a generic template for an unknown event type', () => {
    const { subject } = buildNotification('some_unmapped_event', { foo: 'bar' });
    expect(subject).toContain('some_unmapped_event');
  });
});
