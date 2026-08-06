import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * "Am I signed in yet?" for the tab that sent a magic link and is now
 * waiting. It stayed on "check your email" forever because nothing ever
 * told it the link had been used.
 *
 * Deliberately the thinnest possible endpoint: a boolean, no user data,
 * no error detail. It is polled by an unauthenticated page, so it must
 * be safe to call constantly and reveal nothing beyond whether the
 * caller's *own* cookies now carry a session.
 *
 * Same-browser only, by nature — cookies are the whole mechanism. Opening
 * the link on a different device signs that device in; the original tab
 * keeps waiting, which is why the UI also offers a manual way on.
 */
export async function GET(_request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json(
    { signedIn: Boolean(user) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
