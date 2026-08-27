const nodemailer = require('nodemailer');

let transport;          // built lazily, cached
let warnedUnconfigured = false;

function getTransport() {
  if (transport !== undefined) return transport;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    if (!warnedUnconfigured) {
      console.warn('[email] SMTP is not configured — email notifications are off. See Backend/.env.example');
      warnedUnconfigured = true;
    }
    transport = null;
    return null;
  }

  const port = Number(SMTP_PORT) || 587;
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transport;
}

// Test seam. Pass null to force the unconfigured path, undefined to reset.
function setTransport(next) {
  transport = next;
  warnedUnconfigured = false;
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function render({ title, body, orderId }) {
  const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
  const link = orderId && appUrl ? `${appUrl}/orders/${orderId}` : null;

  const text = [title, body, link && `\nView it here: ${link}`, '\n— VendorVerse']
    .filter(Boolean).join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px">
      <h2 style="color:#B85A1C;margin:0 0 8px">${escapeHtml(title)}</h2>
      ${body ? `<p style="color:#333;margin:0 0 16px">${escapeHtml(body)}</p>` : ''}
      ${link ? `<p><a href="${escapeHtml(link)}" style="background:#FF8940;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;display:inline-block">View order</a></p>` : ''}
      <p style="color:#888;font-size:12px;margin-top:24px">You are getting this because you have a VendorVerse account.</p>
    </div>`;

  return { text, html };
}

async function sendMail({ to, subject, text, html }) {
  const t = getTransport();
  if (!t) return { skipped: 'not-configured' };
  if (!to) return { skipped: 'no-address' };

  await t.sendMail({
    from: process.env.MAIL_FROM || 'VendorVerse <no-reply@vendorverse.app>',
    to,
    subject,
    text,
    html,
  });
  return { sent: true };
}

async function sendNotificationEmail(recipient, note) {
  const { text, html } = render(note);
  return sendMail({ to: recipient?.email, subject: note.title, text, html });
}

async function sendPasswordResetEmail(user, resetUrl) {
  const text = [
    `Hi ${user.name},`,
    '',
    'Somebody asked to reset the password on your VendorVerse account.',
    'Open this link within the next hour to choose a new one:',
    resetUrl,
    '',
    'If that was not you, ignore this email. Your password stays as it is.',
    '',
    '— VendorVerse',
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px">
      <h2 style="color:#B85A1C;margin:0 0 8px">Reset your password</h2>
      <p style="color:#333;margin:0 0 16px">Hi ${escapeHtml(user.name)}, use the button below to choose a new password. The link works for one hour.</p>
      <p><a href="${escapeHtml(resetUrl)}" style="background:#FF8940;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;display:inline-block">Choose a new password</a></p>
      <p style="color:#888;font-size:12px;margin-top:24px">If you did not ask for this, ignore this email and nothing changes.</p>
    </div>`;

  return sendMail({ to: user.email, subject: 'Reset your VendorVerse password', text, html });
}

module.exports = { sendMail, sendNotificationEmail, sendPasswordResetEmail, setTransport, render };
