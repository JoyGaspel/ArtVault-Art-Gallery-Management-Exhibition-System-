const Artist = require('../models/Artist');
const { sendEmail, emailNotificationsEnabled } = require('../config/mailer');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function appLink(path) {
  const base = String(process.env.APP_URL || '').replace(/\/$/, '');
  return `${base}${path}`;
}

function preferenceKey(type) {
  return {
    like: 'emailLikes',
    submission_status: 'emailSubmissionStatus',
    exhibit: 'emailExhibits',
  }[type];
}

function buildEmail(notification) {
  const title = escapeHtml(notification.title);
  const message = escapeHtml(notification.message);
  let path = '/notifications';
  if (notification.type === 'like' && notification.artwork) path = `/artworks/${notification.artwork}`;
  if (notification.type === 'submission_status') path = '/exhibit-submission-status';
  if (notification.type === 'exhibit' && notification.exhibit) path = `/exhibits/${notification.exhibit}`;
  const url = appLink(path);
  const subject = `ArtVault · ${notification.title}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4effc;padding:28px 16px;font-family:Arial,sans-serif;color:#2b2440"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e2dcef;border-radius:16px;overflow:hidden"><div style="background:#6b4fb0;padding:24px;text-align:center;color:#fff;font-size:24px;font-weight:700">ArtVault</div><div style="padding:30px"><h2 style="margin:0 0 14px">${title}</h2><p style="color:#685c86;line-height:1.6">${message}</p><p style="margin:26px 0;text-align:center"><a href="${escapeHtml(url)}" style="display:inline-block;background:#6b4fb0;color:#fff;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:700">Open ArtVault</a></p></div></div></body></html>`;
  const text = `${notification.title}\n\n${notification.message}\n\nOpen ArtVault: ${url}`;
  return { subject, html, text };
}

async function sendNotificationEmail(notification) {
  if (!emailNotificationsEnabled() || !notification?.recipient) return { skipped: true };
  const artist = await Artist.findById(notification.recipient).select('email emailLikes emailSubmissionStatus emailExhibits status').lean();
  if (!artist?.email || artist.status !== 'active') return { skipped: true };

  const key = preferenceKey(notification.type);
  if (key && artist[key] === false) return { skipped: true };

  return sendEmail({ to: artist.email, ...buildEmail(notification) });
}

function sendNotificationEmailInBackground(notification) {
  return sendNotificationEmail(notification)
    .catch((error) => console.error('Notification email could not be sent:', error.message));
}

module.exports = { sendNotificationEmail, sendNotificationEmailInBackground };
