import { jest } from '@jest/globals';

describe('sendEmail', () => {
  const originalApiKey = process.env.BREVO_API_KEY;

  afterEach(() => {
    process.env.BREVO_API_KEY = originalApiKey;
    jest.resetModules();
    jest.dontMock('axios');
  });

  it('skips sending when BREVO_API_KEY is not set, regardless of html', async () => {
    // Set (not delete) to an empty string — dotenv.config() skips keys
    // already present in process.env, even empty ones, so this stops the
    // local .env's real key from being reloaded into a "test" run.
    process.env.BREVO_API_KEY = '';
    jest.resetModules();

    const { sendEmail } = await import('../src/services/brevo.js');
    const result = await sendEmail({ to: 'a@test.com', subject: 'Hi', text: 'Hi', html: '<p>Hi</p>' });

    expect(result).toEqual({ skipped: true });
  });

  it('forwards htmlContent to Brevo alongside textContent when html is provided', async () => {
    process.env.BREVO_API_KEY = 'test_key';
    jest.resetModules();

    const post = jest.fn().mockResolvedValue({ data: { messageId: 'abc' } });
    jest.unstable_mockModule('axios', () => ({ default: { post } }));

    const { sendEmail } = await import('../src/services/brevo.js');
    await sendEmail({ to: 'a@test.com', subject: 'Hi', text: 'Hi there', html: '<p>Hi there</p>' });

    expect(post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ textContent: 'Hi there', htmlContent: '<p>Hi there</p>' }),
      expect.anything()
    );
  });

  it('omits htmlContent when no html is provided', async () => {
    process.env.BREVO_API_KEY = 'test_key';
    jest.resetModules();

    const post = jest.fn().mockResolvedValue({ data: { messageId: 'abc' } });
    jest.unstable_mockModule('axios', () => ({ default: { post } }));

    const { sendEmail } = await import('../src/services/brevo.js');
    await sendEmail({ to: 'a@test.com', subject: 'Hi', text: 'Hi there' });

    const [, payload] = post.mock.calls[0];
    expect(payload).not.toHaveProperty('htmlContent');
  });
});
