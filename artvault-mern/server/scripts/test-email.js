require('dotenv').config();

const { sendEmail } = require('../config/mailer');

async function main() {
  const recipient = process.env.TEST_EMAIL || process.env.SMTP_USER;
  if (!recipient) throw new Error('Set TEST_EMAIL or SMTP_USER before running the email test.');
  await sendEmail({
    to: recipient,
    subject: 'ArtVault SMTP test',
    text: 'Your ArtVault backend SMTP configuration is working.',
    html: '<p>Your ArtVault backend SMTP configuration is working.</p>',
  });
  console.log(`Test email sent to ${recipient}`);
}

main().catch((error) => {
  console.error(`Test email failed: ${error.message}`);
  process.exitCode = 1;
});
