const mailer = require('../config/mailer');

const notices = {
  suspended: {
    subject: 'ArtVault account suspended',
    message: 'Your ArtVault account has been suspended by an administrator. You cannot sign in or manage artworks while it is suspended. Please contact the ArtVault administrators if you believe this is a mistake.',
  },
  active: {
    subject: 'ArtVault account reactivated',
    message: 'Your ArtVault account has been reactivated. You can sign in again.',
  },
  deletion_requested: {
    subject: 'ArtVault account removal requested',
    message: 'Your ArtVault account is suspended pending main-administrator review. Your artworks have been moved to the administrator archive. This is not yet permanent deletion.',
  },
  removed: {
    subject: 'ArtVault account removed',
    message: 'An administrator removed your ArtVault account. Your artworks have been moved to the administrator archive. Contact the ArtVault administrators if this was unexpected.',
  },
  permanently_deleted: {
    subject: 'ArtVault account permanently deleted',
    message: 'Your ArtVault account and its archived account record have been permanently deleted by the main administrator. Contact the ArtVault administrators if this was unexpected.',
  },
};

function sendAccountNoticeInBackground(email, type) {
  if (!email || !notices[type]) return Promise.resolve({ skipped: true });
  const { subject, message } = notices[type];
  return mailer.sendEmail({ to: email, subject, text: message, html: `<p>${message}</p>` })
    .then((result) => {
      if (result?.skipped) console.warn(`Account notice email skipped: ${type}; SMTP notifications are disabled.`);
      return result;
    })
    .catch((error) => {
      console.error(`Account notice email could not be sent (${type}):`, error.message);
      return { failed: true };
    });
}

module.exports = { sendAccountNoticeInBackground };
