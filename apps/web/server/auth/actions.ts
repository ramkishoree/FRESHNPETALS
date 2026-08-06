'use server';

import { validatePassword } from '@prana/identity';
import { z } from 'zod';
import { getPublicEnv } from '@/config/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/safe-next-path';
import { ensureCustomerProfile } from '@/server/customer/ensure-customer-profile';
import { recordSession } from './record-session';
import { checkLockout, recordLoginAttempt } from './lockout';

export interface ActionResult {
  success: boolean;
  error?: string;
  /** True only when the sole reason sign-in failed is an unconfirmed email — lets a poller distinguish "still waiting" from a real credential failure, without that polling ever counting toward login lockout. */
  pending?: boolean;
}

const emailSchema = z.string().trim().toLowerCase().email();
const signUpSchema = z.object({
  email: emailSchema,
  password: z.string(),
  fullName: z.string().trim().min(1).max(200).optional(),
});
const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  fullName?: string;
}): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid email or password format.' };
  }

  const passwordCheck = validatePassword(parsed.data.password);
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.errors.join(' ') };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${getPublicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent('/account?confirmed=1')}`,
      ...(parsed.data.fullName ? { data: { full_name: parsed.data.fullName } } : {}),
    },
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
}): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid email or password.' };
  }
  const { email, password } = parsed.data;

  const lockout = await checkLockout(email);
  if (lockout.locked) {
    return {
      success: false,
      error: 'Too many failed attempts. Try again in 15 minutes.',
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error?.code === 'email_not_confirmed') {
    return { success: false, pending: true, error: 'Email not confirmed yet.' };
  }

  if (error || !data.session || !data.user) {
    await recordLoginAttempt({
      identifier: email,
      userId: data?.user?.id ?? null,
      success: false,
      failureReason: error?.message ?? 'unknown',
    });
    return { success: false, error: 'Invalid email or password.' };
  }

  await recordLoginAttempt({ identifier: email, userId: data.user.id, success: true });
  await ensureCustomerProfile(data.user.id, data.user.email ?? null);

  await recordSession(data.session);

  return { success: true };
}

/**
 * Owner's explicit call: signing up shouldn't mean inventing and
 * remembering a password — email in, tap the link, done. Supabase's OTP
 * flow auto-creates the user on first use (`shouldCreateUser: true`), so
 * this single action covers both "log in" and "sign up" — there's no
 * separate account-creation step to skip. Same response whether the
 * email is new or returning, same reasoning as `requestPasswordReset`
 * (never leak account existence from response shape/timing).
 */
export async function sendMagicLink(input: {
  email: string;
  fullName?: string;
}): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(input.email);
  if (!parsed.success) {
    return { success: false, error: 'Enter a valid email address.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${getPublicEnv().NEXT_PUBLIC_APP_URL}/auth/confirm?next=${encodeURIComponent('/account')}`,
      ...(input.fullName ? { data: { full_name: input.fullName } } : {}),
    },
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function signOut(): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.auth.signOut();
  if (error) return { success: false, error: error.message };

  if (user) {
    const admin = createSupabaseAdminClient();
    await admin
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('revoked_at', null);
  }

  return { success: true };
}

export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(input.email);
  if (!parsed.success) {
    // Same response whether the email exists or not — Ch.15 account
    // recovery flow should never leak account existence.
    return { success: true };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${getPublicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=/account/security`,
  });

  return { success: true };
}

export async function confirmPasswordReset(input: { newPassword: string }): Promise<ActionResult> {
  const passwordCheck = validatePassword(input.newPassword);
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.errors.join(' ') };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: input.newPassword });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * `next` is where the customer was headed before being asked to sign in
 * — usually `/checkout`. Without carrying it through the OAuth round
 * trip, Google users always landed on `/account`, losing the checkout
 * they were in the middle of, while email/password users returned
 * correctly. Sanitised here as well as at the callback: this value ends
 * up in a URL, so it is never trusted just because it came from our own
 * form.
 */
export async function getGoogleSignInUrl(next?: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const callback = new URL('/auth/callback', getPublicEnv().NEXT_PUBLIC_APP_URL);
  callback.searchParams.set('next', safeNextPath(next));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callback.toString() },
  });
  if (error) return null;
  return data.url;
}
