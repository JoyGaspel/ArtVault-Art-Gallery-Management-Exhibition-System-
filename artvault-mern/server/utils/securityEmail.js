function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function securityEmail({ title, message, code, footer }) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeFooter = escapeHtml(footer);
  const codeBlock = code ? `<tr><td align="center" style="padding:8px 24px 24px"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f1ecfb;border:1px solid #ded0f7;border-radius:12px"><tr><td align="center" style="padding:14px 8px 6px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:1px;color:#685c86">YOUR VERIFICATION CODE</td></tr><tr><td align="center" style="padding:4px 8px 14px;font-family:Consolas,'Courier New',monospace;font-size:30px;font-weight:bold;letter-spacing:3px;color:#4e3580;white-space:nowrap">${escapeHtml(code)}</td></tr><tr><td align="center" style="padding:0 12px 16px;font-family:Arial,sans-serif;font-size:13px;color:#685c86">Expires in 10 minutes &middot; One-time use</td></tr></table></td></tr>` : '';
  return {
    text: `${title}\n\n${message}${code ? `\n\nYour verification code: ${code}\nExpires in 10 minutes. One-time use.` : ''}\n\n${footer}\n\nArtVault account security`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title></head><body style="margin:0;padding:0;background:#f4effc"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${safeTitle}. ${code ? 'Your verification code expires in 10 minutes.' : 'An update to your account security.'}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4effc"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e2dcef;border-radius:16px"><tr><td align="center" style="background:#6b4fb0;padding:26px 20px;border-radius:16px 16px 0 0;font-family:Georgia,serif;font-size:30px;color:#ffffff;font-weight:bold">ArtVault</td></tr><tr><td style="padding:28px 24px 12px;font-family:Arial,sans-serif;color:#2b2440"><p style="margin:0 0 10px;font-size:11px;letter-spacing:2px;color:#6b4fb0;font-weight:bold">ACCOUNT SECURITY</p><h1 style="margin:0 0 16px;font-size:23px;line-height:1.3">${safeTitle}</h1><p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#685c86">${safeMessage}</p></td></tr>${codeBlock}<tr><td style="padding:8px 24px 28px;font-family:Arial,sans-serif;font-size:13px;line-height:1.7;color:#685c86">${safeFooter}</td></tr><tr><td align="center" style="border-top:1px solid #ece6f4;padding:18px 20px;font-family:Arial,sans-serif;font-size:12px;color:#847593">ArtVault &middot; Gallery &amp; Exhibit System<br>Keep your verification and backup codes private.</td></tr></table></td></tr></table></body></html>`,
  };
}

module.exports = { securityEmail };
