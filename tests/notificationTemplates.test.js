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

  it('every known template includes an HTML body wrapped in the shared layout', () => {
    const eventTypes = ['task_assigned', 'task_status_changed', 'deadline_reminder', 'task_archived', 'daily_digest'];

    for (const eventType of eventTypes) {
      const { html } = buildNotification(eventType, { title: 'Sample task', priority: 'low' });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Task Management &amp; Analytics');
    }
  });

  it('falls back to a generic HTML template for an unknown event type', () => {
    const { html } = buildNotification('some_unmapped_event', { foo: 'bar' });
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('escapes task titles in the HTML body to prevent markup injection', () => {
    const { html } = buildNotification('task_assigned', { title: '<script>alert(1)</script>', priority: 'high' });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders a daily_digest task list as HTML list items', () => {
    const { html } = buildNotification('daily_digest', {
      tasks: [{ title: 'Write docs', priority: 'medium', due_date: '2026-01-01' }],
    });

    expect(html).toContain('<li');
    expect(html).toContain('Write docs');
    expect(html).toContain('2026-01-01');
  });
});
