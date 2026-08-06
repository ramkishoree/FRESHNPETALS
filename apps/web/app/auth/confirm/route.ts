import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from '@/lib/safe-next-path';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { recordSession } from '@/server/auth/record-session';
import { ensureCustomerProfile } from '@/server/customer/ensure-customer-profile';

/**
 * Email-link sign-in that works from *any* browser.
 *
 * `/auth/callback` exchanges a PKCE `code`, which only succeeds in the
 * browser that asked for the link: the `code_verifier` lives in a cookie
 * set when `sendMagicLink` ran. Open the mail in Gmail's in-app browser,
 * on a phone, or in a second browser, and there is no verifier — the
 * exchange fails and the customer is told their link is invalid or
 * expired when it is neither.
 *
 * `verifyOtp` with a `token_hash` carries no such requirement. Whichever
 * browser opens the link is the one that gets signed in, which is what
 * people actually expect from an email link.
 *
 * Requires the Supabase magic-link email template to link here with
 * `{{ .TokenHash }}` — see docs/auth.md. `/auth/callback` stays for the
 * OAuth round trip, which genuinely is same-browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = safeNextPath(searchParams.get('next'), '/account');

  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  if (!tokenHash || !type) {
    return fail('That sign-in link is incomplete. Request a new one.');
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error || !data.user) {
    // Single-use: a mail scanner that pre-opened the link, or a genuinely
    // expired one, both land here.
    return fail('That sign-in link has already been used or has expired. Request a new one.');
  }

  await ensureCustomerProfile(data.user.id, data.user.email ?? null);
  if (data.session) await recordSession(data.session);

  // Straight to the confirmation screen, which reports success and hands
  // the customer back to wherever they were headed.
  return NextResponse.redirect(`${origin}/auth/confirmed?next=${encodeURIComponent(next)}`);
}
