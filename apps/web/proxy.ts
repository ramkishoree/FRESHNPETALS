import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicEnv, getServerEnv } from '@/config/env';

const ADMIN_SESSION_MAX_AGE_HOURS = 12; // Ch.15 §18: admin sessions, 12h vs customer 30d.

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Ch.11 §16 CSP, generated per-request so `script-src` can carry a nonce
 * instead of 'unsafe-inline'. `strict-dynamic` lets scripts the nonce'd
 * entry point loads (Next/Turbopack's own chunk graph, RSC flight payload
 * scripts) run without each needing its own nonce — without it, a static
 * `script-src 'self'` blocks Next's own hydration bootstrap scripts,
 * which silently breaks any client component whose visible output is
 * entirely produced by client-side JS (e.g. Recharts' internal SVG,
 * which has no meaningful SSR markup of its own).
 *
 * `unsafe-eval` is added in dev only: Turbopack/React use eval() in
 * development to reconstruct stack traces for the error overlay. React
 * itself guarantees it never calls eval() in production, so prod keeps
 * the strict policy.
 *
 * Razorpay URLs:
 *   - `https://checkout.razorpay.com` is whitelisted in script-src as a
 *     fallback for browsers that don't support `strict-dynamic` (the
 *     script is loaded via <Script nonce={...}>, which CSP3 browsers
 *     honour through the nonce alone).
 *   - `frame-src` grants the Razorpay checkout.js script permission to
 *     embed its payment iframe at `https://api.razorpay.com`.
 *   - `connect-src` permits Razorpay's telemetry (lumberjack) endpoint.
 *
 * Google Maps (`lib/google-maps.ts`, checkout's delivery pin) loads via a
 * plain injected `<script src="https://maps.googleapis.com/...">` — not
 * the nonce'd `<Script>` component — so it needs an explicit script-src
 * entry rather than relying on `strict-dynamic`; its Places/Geocoding
 * calls also need `connect-src`. Google Analytics (gtag.js) needs the
 * same shape of allowance; both are harmless to whitelist even when
 * unconfigured (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY / _GA_MEASUREMENT_ID
 * unset just means the script never actually loads).
 */
function buildCsp(nonce: string, supabaseUrl: string): string {
  const razorpayScript = 'https://checkout.razorpay.com';
  const googleScripts = 'https://maps.googleapis.com https://www.googletagmanager.com';
  const scriptSrc =
    process.env.NODE_ENV === 'production'
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${razorpayScript} ${googleScripts}`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' ${razorpayScript} ${googleScripts}`;
  return [
    "default-src 'self'",
    scriptSrc,
    // Google's Places Autocomplete widget injects its own font stylesheet
    // (fonts.googleapis.com -> fonts.gstatic.com) at runtime — blocking it
    // doesn't just lose a font, it corrupts the widget's internal DOM
    // bookkeeping until it throws an uncaught removeChild error that took
    // down the whole /checkout page in production.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    // Video had no directive of its own, so it fell through to
    // `default-src 'self'` and every clip served from Supabase Storage
    // was refused with "Media load rejected by URL safety check" — the
    // homepage hero's video slot and the product gallery's videos alike.
    // Scoped to the project's own storage origin rather than opened up
    // to `https:` the way images are: media is uploaded through the
    // admin, so there is exactly one host it can legitimately come from.
    `media-src 'self' ${supabaseUrl}`,
    "font-src 'self' https://fonts.gstatic.com",
    // PlaceAutocompleteElement (the modern Places widget) calls
    // places.googleapis.com directly via XHR/RPC — a different host than
    // the maps.googleapis.com script itself loads from.
    `connect-src 'self' ${supabaseUrl} https://lumberjack.razorpay.com https://maps.googleapis.com https://places.googleapis.com https://www.google-analytics.com`,
    'frame-src https://api.razorpay.com https://checkout.razorpay.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/**
 * Refreshes the Supabase session cookie on every matched request, then
 * gates /account (any authenticated user) and /admin (administrator/owner
 * only). The destination pages don't exist yet (Phase 8/9) — this is the
 * routing/session infrastructure the roadmap asks Phase 4 to build; the
 * pages that render behind these guards come later without changing this
 * file.
 */
export async function proxy(request: NextRequest) {
  const env = getPublicEnv();
  const nonce = generateNonce();
  const csp = buildCsp(nonce, env.NEXT_PUBLIC_SUPABASE_URL);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.headers.set('Content-Security-Policy', csp);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { pathname } = request.nextUrl;

  /**
   * `getUser()` refreshes the session, and supabase-js *throws* when the
   * refresh token is stale — `AuthApiError: refresh_token_not_found` —
   * rather than reporting a signed-out user. Unhandled here that killed
   * the whole request, on every route, because middleware runs before
   * anything else: the customer saw a generic failure screen with no
   * clue which page it belonged to. It surfaced hardest right after
   * checkout, where the auth cookie churns most and the order is already
   * committed, so a completed purchase looked like a crash.
   *
   * A refresh that fails means exactly one thing — this request isn't
   * authenticated. The gates below already handle that. So it must never
   * be fatal.
   */
  let user = null;
  let staleSession = false;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (cause) {
    staleSession = true;
    console.warn(
      JSON.stringify({
        level: 'warn',
        message: 'proxy.session_refresh_failed',
        pathname,
        error: cause instanceof Error ? cause.message : String(cause),
      }),
    );
  }

  /**
   * Clear the credentials that just failed. Without this the browser
   * keeps presenting the same dead token on every subsequent request, so
   * the fault repeats until someone clears cookies by hand — the user is
   * signed out but can't get back in.
   */
  const clearStaleAuthCookies = (target: NextResponse) => {
    if (!staleSession) return target;
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')) {
        target.cookies.set(cookie.name, '', { maxAge: 0, path: '/' });
      }
    }
    return target;
  };

  if (staleSession) {
    response = clearStaleAuthCookies(response);
  }

  const isAccountRoute = pathname.startsWith('/account');
  const isAdminRoute = pathname.startsWith('/admin');

  if (!user && (isAccountRoute || isAdminRoute)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.headers.set('Content-Security-Policy', csp);
    return clearStaleAuthCookies(redirectResponse);
  }

  if (user && isAdminRoute) {
    const serverEnv = getServerEnv();
    const admin = createClient(
      serverEnv.NEXT_PUBLIC_SUPABASE_URL,
      serverEnv.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );

    const { data: session } = await admin
      .from('sessions')
      .select('created_at')
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sessionAgeHours = session
      ? (Date.now() - new Date(session.created_at as string).getTime()) / 3_600_000
      : Infinity;

    const { data: userRoles } = await admin
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', user.id);

    const isAdmin = (userRoles ?? []).some((row) => {
      const roleName = (row.roles as unknown as { name: string } | null)?.name;
      return roleName === 'administrator' || roleName === 'owner';
    });

    if (!isAdmin) {
      const redirectResponse = NextResponse.redirect(new URL('/', request.url));
      redirectResponse.headers.set('Content-Security-Policy', csp);
      return redirectResponse;
    }

    if (sessionAgeHours > ADMIN_SESSION_MAX_AGE_HOURS) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      loginUrl.searchParams.set('reason', 'session_expired');
      const redirectResponse = NextResponse.redirect(loginUrl);
      redirectResponse.headers.set('Content-Security-Policy', csp);
      return redirectResponse;
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
