const nodemailer = require('nodemailer');

let transporter;

function emailNotificationsEnabled() {
  return String(process.env.EMAIL_NOTIFICATIONS_ENABLED || '').toLowerCase() === 'true';
}

function getTransporter() {
  if (!emailNotificationsEnabled()) return null;
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) {
    throw new Error('SMTP is enabled but SMTP_HOST, SMTP_USER, or SMTP_PASSWORD is missing.');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465,
    auth: { user, pass: password },
  });
  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  if (!emailNotificationsEnabled()) return { skipped: true };
  if (!to) throw new Error('A recipient email address is required.');

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error('SMTP_FROM or SMTP_USER must be configured.');

  return getTransporter().sendMail({
    from,
    to,
    subject,
    html,
    text,
  });
}

module.exports = { sendEmail, emailNotificationsEnabled };
