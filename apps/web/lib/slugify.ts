/** Turns free-text (e.g. an outlet's `city` column) into a URL-safe slug. No existing slugify utility in the codebase — `city` is plain text, not itself a slug column. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
