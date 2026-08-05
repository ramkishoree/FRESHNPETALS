import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from '@/lib/safe-next-path';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureCustomerProfile } from '@/server/customer/ensure-customer-profile';

/**
 * OAuth (Google) and email-link (verification, password reset) callback.
 * Exchanges the auth code for a session, then provisions the customer's
 * `customers` row if this is their first authenticated request (see
 * ensure-customer-profile.ts for why that can't happen via a DB trigger
 * or client-side insert).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Never interpolated raw: `${origin}${next}` with next="//evil.com"
  // is an open redirect that hands an attacker a freshly signed-in
  // session. See safeNextPath.
  const next = safeNextPath(searchParams.get('next'));

  // Supabase reports a refused provider (Google not enabled, consent
  // denied, expired link) by redirecting back here with error params and
  // no code. Pass its own wording through instead of dropping the user on
  // a login page that says nothing about what went wrong.
  const providerError = searchParams.get('error_description') ?? searchParams.get('error');
  if (providerError && !code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(providerError.slice(0, 200))}`,
    );
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) await ensureCustomerProfile(data.user.id, data.user.email ?? null);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('That sign-in link is invalid or has expired. Try again.')}`,
  );
}
