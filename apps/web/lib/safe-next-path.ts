const DEFAULT_NEXT = '/account';

/**
 * Sanitises a `?next=` value before anything redirects to it.
 *
 * Post-login redirects are the classic open-redirect vector: the value
 * arrives in a URL an attacker can hand to a victim, and it gets used
 * after the victim authenticates. `${origin}${next}` looks safe until
 * `next` is `//evil.example.com`, which browsers read as a new host —
 * the victim lands on the attacker's site already signed in, on a page
 * that legitimately came from a link to the real domain.
 *
 * So only a path anchored at the site root is accepted: one leading
 * slash, no second slash or backslash behind it, no scheme.
 */
export function safeNextPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_NEXT,
): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/')) return fallback;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  return raw;
}
