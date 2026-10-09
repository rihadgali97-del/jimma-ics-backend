import argon2 from 'argon2';

// Argon2id is argon2's default and recommended variant (resistant to both
// GPU cracking and side-channel attacks) — never swap to bcrypt/md5/sha here.
export async function hashPassword(plain) {
  return argon2.hash(plain);
}

export async function verifyPassword(hash, plain) {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // argon2.verify throws on a malformed hash rather than returning false.
    return false;
  }
}