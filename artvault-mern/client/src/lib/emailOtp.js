export const EMAIL_OTP_LENGTH = 8;
export const EMAIL_OTP_PATTERN = `[0-9]{${EMAIL_OTP_LENGTH}}`;

export function normalizeEmailOtp(value) {
  return String(value || '').replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH);
}

export function isValidEmailOtp(value) {
  const code = String(value || '').trim();
  return code.length === EMAIL_OTP_LENGTH && /^\d+$/.test(code);
}
