/**
 * A hung/unresponsive Supabase endpoint must not stall a server render
 * indefinitely (Ch.17 §131 TTFB budget). `AbortSignal.timeout` bounds each
 * attempt; postgrest-js treats an aborted attempt as non-retryable (it
 * rethrows immediately on `AbortError`), so this also prevents the
 * library's default 3-attempt/7s exponential backoff from compounding on
 * top of a request that was already timing out.
 */
const SUPABASE_FETCH_TIMEOUT_MS = 5000;

export const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeoutSignal = AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
  return fetch(input, { ...init, signal });
};
