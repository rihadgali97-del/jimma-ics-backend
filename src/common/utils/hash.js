import crypto from 'crypto';

// Used for refresh tokens and password-reset tokens — these are already
// high-entropy random/JWT strings, not user-chosen passwords, so a fast
// cryptographic hash (rather than argon2) is appropriate and lets us do a
// direct unique-index lookup by hash.
export function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}