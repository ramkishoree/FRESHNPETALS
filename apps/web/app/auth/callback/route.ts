import { NextResponse, type NextRequest } from 'next/server';
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
  const next = searchParams.get('next') ?? '/account';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) await ensureCustomerProfile(data.user.id, data.user.email ?? null);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
