const RECOVERY_DAYS = 30;
const RECOVERY_MS = RECOVERY_DAYS * 24 * 60 * 60 * 1000;

function artistRecoveryDeadline(from = new Date()) {
  return new Date(new Date(from).getTime() + RECOVERY_MS);
}

function isArtistRecoverable(archive, now = new Date()) {
  return archive?.entityType === 'artwork'
    && archive.artistRecoverUntil
    && new Date(archive.artistRecoverUntil).getTime() > new Date(now).getTime();
}

module.exports = { RECOVERY_DAYS, artistRecoveryDeadline, isArtistRecoverable };
