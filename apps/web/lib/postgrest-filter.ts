/**
 * PostgREST's `.or()` filter mini-language treats `,()` as structural
 * (condition separators / grouping) — interpolating a raw user-supplied
 * string into it lets that string inject additional filter conditions.
 * Strips anything but word characters and spaces before building a
 * filter; costs nothing for a best-effort keyword/ILIKE search.
 */
export function sanitizeForPostgrestFilter(query: string): string {
  return query.replace(/[^\w\s]/g, ' ').trim();
}
