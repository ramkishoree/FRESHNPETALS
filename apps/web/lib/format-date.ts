/**
 * `toLocaleDateString()`/`toLocaleString()` with no arguments resolve to
 * the *runtime's* default locale — which differs between the Node SSR
 * process and the browser, producing a React hydration mismatch the
 * instant any date-formatted text renders (server "01/06/2026" vs.
 * client "1/6/2026"). Pinning the locale makes server and client agree.
 */
const DATE_LOCALE = 'en-IN';

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleDateString(DATE_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleString(DATE_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
