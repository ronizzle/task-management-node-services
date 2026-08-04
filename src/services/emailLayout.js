/**
 * Wraps a template's inner HTML in a minimal, table-based transactional
 * email layout. Inline styles only — most email clients strip <style>
 * blocks, so anything that needs to render reliably has to live on the
 * element itself.
 */
export function renderEmail({ heading, bodyHtml }) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#f4f5f7; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
            <tr>
              <td style="background-color:#1f2937; padding:20px 24px;">
                <span style="color:#ffffff; font-size:18px; font-weight:bold;">Task Management &amp; Analytics</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 16px; font-size:20px; color:#111827;">${escapeHtml(heading)}</h1>
                <div style="font-size:14px; line-height:1.6; color:#374151;">${bodyHtml}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px; background-color:#f9fafb; font-size:12px; color:#9ca3af;">
                This is an automated notification — please don't reply to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}
