/**
 * Ch.15 §15: min 12 chars, upper/lower/number/special, blocklist common
 * passwords. Supabase Auth itself must also be configured (project
 * dashboard, Phase 13) with a matching minimum-length rule — this check is
 * an app-side, better-UX-messaging layer in front of that, not a
 * replacement for it. Hashing/salting/storage is entirely Supabase Auth's
 * responsibility (§79) — nothing here ever sees a stored hash.
 */

const MIN_LENGTH = 12;

// A short, deliberately non-exhaustive blocklist of the most commonly
// breached passwords that would otherwise pass the complexity regexes.
const COMMON_PASSWORDS = new Set([
  'password123!',
  'password1234',
  'qwertyuiop123',
  'letmein12345',
  'welcome12345',
  'admin1234567',
]);

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters.`);
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must include a lowercase letter.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must include an uppercase letter.');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must include a number.');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must include a special character.');
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is too common. Choose something less guessable.');
  }

  return { valid: errors.length === 0, errors };
}
