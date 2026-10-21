const crypto = require('node:crypto');

function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function needsMfa(user, verifiedClaims) {
  return user.factors?.some((factor) => factor.status === 'verified') && verifiedClaims?.aal !== 'aal2';
}
module.exports = { tokenHash, needsMfa };
